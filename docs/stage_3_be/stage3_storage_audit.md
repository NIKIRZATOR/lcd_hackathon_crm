# Stage 3 Storage Audit

Дата: 2026-09-22

Этот audit фиксирует состояние file-related backend до изменений Stage 3. На этом шаге runtime-код не менялся.

## Текущее состояние

### Database models

- `backend/app/modules/documents/model.py`
  - Определяет `File`, связанный с таблицей `files`.
  - Текущие поля:
    - `id`
    - `original_name`
    - `storage_name`
    - `storage_path`
    - `mime_type`
    - `extension`
    - `size_bytes`
    - `checksum`
    - `uploaded_by`
    - `created_at`
- `backend/app/modules/workflows/model.py`
  - Определяет `WorkflowStageAttachment`, связанный с таблицей `workflow_stage_attachments`.
  - Текущие поля:
    - `id`
    - `stage_instance_id`
    - `file_id`
    - `uploaded_by`
    - `description`
    - `created_at`
  - Существующая цепочка связей сохраняется:
    - `workflow_stage_attachments.stage_instance_id -> workflow_stage_instances.id`
    - `workflow_stage_instances.interaction_id -> university_interactions.id`
    - `workflow_stage_attachments.file_id -> files.id`

### Migration

- Initial schema создается в `backend/migrations/versions/cade47f9d409_init_crm_schema.py`.
- `files.uploaded_by -> users.id` уже существует.
- `workflow_stage_attachments.uploaded_by -> users.id` уже существует.
- `workflow_stage_attachments.file_id -> files.id` уже существует.
- `workflow_stage_attachments.stage_instance_id -> workflow_stage_instances.id` уже существует.

### Repositories, services, schemas, routers

- `backend/app/modules/documents/repository.py`, `service.py`, `schemas.py` на момент audit были placeholders.
- `backend/app/modules/documents/router.py` регистрировал пустой router `/documents`.
- `backend/app/modules/workflows/repository.py` содержал `WorkflowStageAttachmentRepository` как базовый subclass `CRUDRepository`.
- `backend/app/modules/workflows/router.py` уже отдавал workflow runtime endpoints, но attachment upload/list/download/delete endpoints еще не было.
- Backend endpoint, принимающий `UploadFile`, отсутствовал.
- Backend endpoint, отдающий file content через `FileResponse` или `StreamingResponse`, отсутствовал.

### Текущее поведение workflow attachments

- Stage 2 использовал attachment rows только как metadata/readiness markers.
- `backend/app/modules/workflows/service.py` проверял `WorkflowStage.requires_attachment` через `_count_stage_attachments(stage_instance_id)`.
- На момент audit проверка считала все rows в `workflow_stage_attachments` для stage instance.
- Так как Stage 3 вводит soft delete в `files`, этот счетчик нужно было изменить так, чтобы учитывались только active, non-purged files.

### Local filesystem usage

- Активная реализация upload/download через local filesystem не найдена.
- `storage_name` и `storage_path` существуют в таблице/model `files`, но код не пишет binary content по этим путям.
- Использование `Path` в scripts ограничено helper scripts вроде demo data setup и не относится к file storage.

### Docker и environment

- `docker-compose.yml` на момент audit содержал:
  - `postgres`
  - `backend`
  - `keycloak-db-init`
  - `frontend`
  - `keycloak`
- Existing persistent volumes:
  - `postgres_data`
  - `frontend_node_modules`
- MinIO/S3 service еще не был настроен.
- Root `.env.example` и `backend/.env.example` еще не содержали S3/MinIO settings.

### Audit helpers

- `backend/app/modules/audit/model.py` определяет `audit_events`.
- `backend/app/modules/audit/service.py` предоставляет `AuditService.log_event(...)`.
- Existing file-related audit action constants:
  - `file.upload`
  - `file.download`
  - `file.delete`
  - `file.scan_status_changed`
  - `storage.presign_generated`
- Stage 3 должен был добавить/использовать:
  - `file.upload`
  - `file.download`
  - `file.delete`
  - `file.restore`
  - `file.purge`

### Data scope helpers

- `backend/app/modules/auth/access.py` предоставляет reusable interaction scope checks.
- Existing helpers для переиспользования:
  - `ensure_can_read_interaction`
  - `forbidden`
  - `is_admin`
  - role constants: `CRM_ROLES`, `ADMIN_ROLES`
- Workflow runtime routes уже используют `_ensure_can_access_interaction(...)` перед interaction-scoped operations.

## Existing API, который нужно сохранить

- Stage 2 workflow runtime API должен остаться compatible:
  - `GET /api/workflows/stage-instances`
  - `GET /api/workflows/interactions/{interaction_id}/current-stage`
  - `GET /api/workflows/interactions/{interaction_id}/available-transitions`
  - `PATCH /api/workflows/stage-instances/{stage_instance_id}/status`
  - `GET /api/workflows/transition-history`
  - `POST /api/workflows/interactions/{interaction_id}/transition`
- Existing `requires_attachment` behavior должен остаться концептуально тем же: transition блокируется, если текущий stage требует active attachment, а его нет.
- Новые Stage 3 attachment endpoints должны быть additive.

## Legacy columns

Следующие поля `files` считаются legacy для Stage 3:

- `storage_name`
- `storage_path`

Их нельзя использовать как основной object storage identity в новом коде. Stage 3 должен ввести и использовать:

- `provider`
- `bucket`
- `object_key`

Legacy columns должны остаться на Stage 3 для backward-compatible migrations и чтобы не делать destructive schema changes.

## Что будет заменено или расширено

- Placeholder `documents` module должен стать shared file metadata и storage orchestration layer.
- Workflow attachment logic должна вызывать `FileService`, а не object storage напрямую.
- Object storage access должен идти через abstraction `StorageAdapter`.
- Workflow/import/report business service не должен напрямую импортировать MinIO client.
- `files` должна быть расширена object storage metadata, scan status и lifecycle fields.
- Attachment list/download/readiness checks должны исключать soft-deleted и purged files.

## Stage 2 dependencies для переиспользования

- Existing workflow runtime model:
  - `WorkflowStageInstance`
  - `WorkflowStageAttachment`
  - `WorkflowStage.requires_attachment`
- Existing interaction scope и RBAC helpers.
- Existing audit infrastructure.
- Existing error envelope и request id helpers.
- Existing SQLAlchemy/Alembic conventions.
- Existing Docker Compose layout.

## Step A verification

Step A считается выполненным, когда этот файл существует и точно отражает состояние implementation на момент audit. Следующий проверяемый шаг после него - MinIO infrastructure в Docker Compose и env examples.

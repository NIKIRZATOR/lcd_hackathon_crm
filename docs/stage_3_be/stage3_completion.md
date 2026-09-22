# Завершение Stage 3 Backend

Дата: 2026-09-22

## Краткий итог

Stage 3 backend для файлового хранилища реализован для workflow attachments.

Backend теперь хранит бинарное содержимое файлов в S3-compatible object storage через `StorageAdapter`, а в PostgreSQL оставляет metadata и lifecycle-состояние. Для workflow attachments поддержаны upload, list, download, soft delete, restore и отложенный purge. Доступ проверяется через существующий interaction data scope.

## Измененные файлы

- `.env.example` - добавлены S3/env настройки и file lifecycle настройки.
- `backend/.env.example` - добавлены S3/env настройки и file lifecycle настройки.
- `docker-compose.yml` - добавлены MinIO, bucket initialization, persistent MinIO volume и backend S3 env.
- `backend/requirements.txt` - добавлен MinIO SDK.
- `backend/app/core/config.py` - добавлены S3 settings, retention и max upload size.
- `backend/app/modules/documents/model.py` - расширена модель `files` metadata/lifecycle полями.
- `backend/app/modules/documents/file_service.py` - добавлен сервис управления file lifecycle.
- `backend/app/modules/documents/schemas.py` - добавлена response schema для workflow attachment.
- `backend/app/modules/workflows/router.py` - добавлены workflow attachment API endpoints.
- `backend/app/modules/workflows/service.py` - `requires_attachment` теперь считает только active files.
- `backend/app/storage/adapter.py` - добавлена storage abstraction.
- `backend/app/storage/s3.py` - добавлена S3-compatible реализация через MinIO SDK.
- `backend/app/storage/factory.py` - добавлена фабрика adapter из config.
- `backend/migrations/versions/f4a9c7d2e6b3_extend_files_for_object_storage.py` - добавлена migration для `files`.
- `backend/scripts/purge_deleted_files.py` - добавлена purge-команда.
- `backend/tests/unit/test_file_service.py` - добавлены unit-тесты file lifecycle.
- `docs/db_architecture.md` - обновлены схема `files` и workflow attachment API.
- `docs/stage_3_be/stage3_storage_audit.md` - зафиксирован audit до Stage 3 изменений.

## Новые сервисы

- `FileService`
  - Валидирует имя файла, extension, MIME, пустой файл и максимальный размер.
  - Считает SHA-256 checksum.
  - Пишет binary content в object storage.
  - Сохраняет metadata в `files` и связь в `workflow_stage_attachments`.
  - Делает best-effort cleanup object, если DB save падает после upload.
  - Отдает download stream через backend.
  - Выполняет soft delete и restore.
  - Удаляет expired soft-deleted objects при purge.

- `StorageAdapter`
  - Предоставляет `put`, `get_stream`, `delete`, `stat`, `presign_get`.

- `S3CompatibleStorage`
  - Реализует `StorageAdapter` через MinIO Python SDK.

## Новые env-переменные

- `S3_ENDPOINT`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_REGION`
- `S3_USE_SSL`
- `S3_BUCKET_WORKFLOW_FILES`
- `S3_BUCKET_IMPORTS`
- `S3_BUCKET_REPORTS`
- `FILE_RETENTION_DAYS`
- `FILE_MAX_UPLOAD_BYTES`

## Docker / MinIO

В Docker Compose добавлены:

- `minio`
- `minio-init`
- persistent volume `minio_data`

Buckets создаются автоматически:

- `workflow-files`
- `imports`
- `reports`

Buckets не делаются public.

## Изменения БД

`files` расширена полями:

- `provider`
- `bucket`
- `object_key`
- `scan_status`
- `deleted_at`
- `delete_after`
- `deleted_by`
- `purged_at`

Constraints и indexes:

- `uq_files_provider_bucket_object_key`
- `ix_files_cleanup_state`
- FK `files.deleted_by -> users.id`

Legacy-поля сохранены:

- `storage_name`
- `storage_path`

## Alembic revision

- `f4a9c7d2e6b3_extend_files_for_object_storage.py`

## API

Все endpoints требуют роль `KAM`, `MANAGER` или `ADMIN` и переиспользуют существующий interaction data scope.

| Method | Path | Назначение |
| --- | --- | --- |
| `POST` | `/api/workflows/stage-instances/{stage_instance_id}/attachments` | Upload PDF/DOCX/XLSX attachment. |
| `GET` | `/api/workflows/stage-instances/{stage_instance_id}/attachments` | Список active attachments. |
| `GET` | `/api/workflows/attachments/{attachment_id}/download` | Download active attachment через backend. |
| `DELETE` | `/api/workflows/attachments/{attachment_id}` | Soft delete attachment file. |
| `POST` | `/api/workflows/attachments/{attachment_id}/restore` | Restore soft-deleted attachment до purge. |

## File lifecycle

- Upload сохраняет binary content в `workflow-files`, а metadata в PostgreSQL.
- Active files: `deleted_at = NULL` и `purged_at = NULL`.
- Delete выставляет `deleted_at`, `delete_after`, `deleted_by`.
- Restore очищает `deleted_at`, `delete_after`, `deleted_by`.
- Purge удаляет expired objects из storage и выставляет `purged_at` только после успешного storage delete.

## Data scope

Attachment endpoints находят stage instance, затем связанный interaction и вызывают существующую policy `ensure_can_read_interaction`:

- KAM: свои interactions.
- MANAGER: interactions подчиненных KAM.
- ADMIN: все interactions.
- Explicit data scopes продолжают поддерживаться существующим helper.

## Audit events

Реализованы:

- `file.upload`
- `file.download`
- `file.delete`
- `file.restore`
- `file.purge`

## Security rules

- Buckets не public.
- Original filename не используется как object key.
- Backend контролирует authorization и streaming.
- Текущие uploads получают `scan_status = NOT_SCANNED`; antivirus scanning в Stage 3 не реализован.
- Разрешенные типы workflow attachment upload: PDF, DOCX, XLSX.

## Tests

Добавлено:

- `backend/tests/unit/test_file_service.py`

Покрыто:

- Successful upload пишет object, metadata, attachment, checksum и audit.
- Unsupported extension отклоняется до storage write.
- DB failure после storage upload запускает best-effort object cleanup.
- Soft delete и restore обновляют lifecycle fields и audit.
- Purge удаляет storage object до установки `purged_at` и audit.

Existing transition tests были запущены, чтобы проверить отсутствие регрессии Stage 2 workflow behavior.

## Остаточные ограничения

- Frontend attachment UI в Stage 3 не реализуется.
- ClamAV и реальный antivirus scan в Stage 3 не реализуются.
- Async worker не добавлен; purge выполняется script command.
- Buckets `imports` и `reports` созданы, но бизнес-логика imports/reports намеренно не реализована в Stage 3.

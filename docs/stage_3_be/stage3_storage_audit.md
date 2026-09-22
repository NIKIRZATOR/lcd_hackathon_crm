# Stage 3 Storage Audit

Date: 2026-09-22

This audit documents the existing file-related backend before Stage 3 changes. No runtime code was changed in this step.

## Existing State

### Database Models

- `backend/app/modules/documents/model.py`
  - Defines `File` mapped to `files`.
  - Current columns:
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
  - Defines `WorkflowStageAttachment` mapped to `workflow_stage_attachments`.
  - Current columns:
    - `id`
    - `stage_instance_id`
    - `file_id`
    - `uploaded_by`
    - `description`
    - `created_at`
  - Keeps the existing relation chain:
    - `workflow_stage_attachments.stage_instance_id -> workflow_stage_instances.id`
    - `workflow_stage_instances.interaction_id -> university_interactions.id`
    - `workflow_stage_attachments.file_id -> files.id`

### Migration

- Initial schema is created in `backend/migrations/versions/cade47f9d409_init_crm_schema.py`.
- `files.uploaded_by -> users.id` already exists.
- `workflow_stage_attachments.uploaded_by -> users.id` already exists.
- `workflow_stage_attachments.file_id -> files.id` already exists.
- `workflow_stage_attachments.stage_instance_id -> workflow_stage_instances.id` already exists.

### Repositories, Services, Schemas, Routers

- `backend/app/modules/documents/repository.py`, `service.py`, and `schemas.py` are currently placeholders.
- `backend/app/modules/documents/router.py` registers an empty `/documents` router.
- `backend/app/modules/workflows/repository.py` has `WorkflowStageAttachmentRepository`, currently only as a basic `CRUDRepository` subclass.
- `backend/app/modules/workflows/router.py` exposes workflow runtime endpoints, but no attachment upload/list/download/delete endpoints yet.
- No existing backend endpoint currently accepts `UploadFile`.
- No existing backend endpoint currently streams file content with `FileResponse` or `StreamingResponse`.

### Current Workflow Attachment Behavior

- Stage 2 uses attachment rows only as metadata/readiness markers.
- `backend/app/modules/workflows/service.py` checks `WorkflowStage.requires_attachment` through `_count_stage_attachments(stage_instance_id)`.
- The current check counts all rows in `workflow_stage_attachments` for a stage instance.
- Because Stage 3 introduces soft delete on `files`, this check must later count only active, non-purged files.

### Local Filesystem Usage

- No active local filesystem upload/download implementation was found.
- `storage_name` and `storage_path` exist in the `files` table/model, but no code currently writes binary content to those paths.
- Script usage of `Path` is limited to helper scripts such as demo data setup and is unrelated to file storage.

### Docker And Environment

- `docker-compose.yml` currently defines:
  - `postgres`
  - `backend`
  - `keycloak-db-init`
  - `frontend`
  - `keycloak`
- Existing persistent volumes:
  - `postgres_data`
  - `frontend_node_modules`
- No MinIO/S3 service is configured yet.
- Root `.env.example` and `backend/.env.example` do not contain S3/MinIO settings yet.

### Audit Helpers

- `backend/app/modules/audit/model.py` defines `audit_events`.
- `backend/app/modules/audit/service.py` exposes `AuditService.log_event(...)`.
- Existing file-related audit action constants:
  - `file.upload`
  - `file.download`
  - `file.delete`
  - `file.scan_status_changed`
  - `storage.presign_generated`
- Stage 3 must add/use:
  - `file.upload`
  - `file.download`
  - `file.delete`
  - `file.restore`
  - `file.purge`

### Data Scope Helpers

- `backend/app/modules/auth/access.py` provides reusable interaction scope checks.
- Existing helpers to reuse:
  - `ensure_can_read_interaction`
  - `forbidden`
  - `is_admin`
  - role constants: `CRM_ROLES`, `ADMIN_ROLES`
- Workflow runtime routes already use `_ensure_can_access_interaction(...)` before interaction-scoped operations.

## Existing API To Preserve

- Stage 2 workflow runtime API must remain compatible:
  - `GET /api/workflows/stage-instances`
  - `GET /api/workflows/interactions/{interaction_id}/current-stage`
  - `GET /api/workflows/interactions/{interaction_id}/available-transitions`
  - `PATCH /api/workflows/stage-instances/{stage_instance_id}/status`
  - `GET /api/workflows/transition-history`
  - `POST /api/workflows/interactions/{interaction_id}/transition`
- Existing `requires_attachment` behavior must remain conceptually the same: a transition is blocked when the current stage requires an active attachment and none exists.
- New Stage 3 attachment endpoints should be additive.

## Legacy Columns

The following `files` columns are legacy for Stage 3:

- `storage_name`
- `storage_path`

They should not be used as the primary object storage identity in new code. Stage 3 should introduce and use:

- `provider`
- `bucket`
- `object_key`

The legacy columns should remain during Stage 3 for backward-compatible migrations and to avoid destructive schema changes.

## What Will Be Replaced Or Extended

- The placeholder `documents` module should become the shared file metadata and storage orchestration layer.
- Workflow attachment logic should call a `FileService`, not object storage directly.
- Object storage access should go through a `StorageAdapter` abstraction.
- No workflow/import/report business service should import a MinIO client directly.
- `files` should be extended with object storage metadata, scan status, and lifecycle fields.
- Attachment list/download/readiness checks should exclude soft-deleted and purged files.

## Stage 2 Dependencies To Reuse

- Existing workflow runtime model:
  - `WorkflowStageInstance`
  - `WorkflowStageAttachment`
  - `WorkflowStage.requires_attachment`
- Existing interaction scope and RBAC helpers.
- Existing audit infrastructure.
- Existing error envelope and request id helpers.
- Existing SQLAlchemy/Alembic conventions.
- Existing Docker Compose layout.

## Step A Verification

This step is complete when this file exists and accurately reflects the current implementation. The next verifiable step is MinIO infrastructure in Docker Compose and env examples.

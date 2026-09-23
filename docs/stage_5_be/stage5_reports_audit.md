# Stage 5 Reports Audit

Date: 2026-09-23

## Scope

This document records the mandatory STEP 0 audit before implementing Stage 5 Backend: Reports / Analytics / Background Jobs.

Source of truth checked:

- `docker-compose.yml`
- `backend/requirements.txt`
- `backend/app/core/config.py`
- `backend/app/core/database.py`
- `backend/app/models.py`
- `backend/migrations/env.py`
- `backend/migrations/versions/*`
- `backend/app/modules/auth/*`
- `backend/app/modules/interactions/*`
- `backend/app/modules/licenses/*`
- `backend/app/modules/documents/*`
- `backend/app/modules/imports/*`
- `backend/app/modules/audit/*`
- `backend/app/modules/analytics/*`
- `backend/app/storage/*`
- `backend/tests/*`

## Summary

| Area | Status | Notes |
| --- | --- | --- |
| Redis | `MISSING` | No Redis service in `docker-compose.yml`; no Redis settings or Python dependency. |
| worker | `MISSING` | No backend worker package/process; imports are synchronous. |
| report schema | `MISSING` | No `report_jobs` or `report_artifacts` models/migrations. |
| query layer | `MISSING` | No `ReportQueryService`; current interaction listing has a narrower scoped repository. |
| analytics | `PARTIAL` | `backend/app/modules/analytics` exists and router is included, but contains only an empty router/service/repository/schema skeleton. |
| exports | `MISSING` | No XLS/XLSX/PDF/JSON report exporters. Dependencies include `openpyxl`, `xlrd`, `xlwt`, but no PDF library and no report exporter code. |
| files integration | `REUSE` | `StorageAdapter`, S3-compatible storage, `files` metadata/lifecycle, and artifact pattern from imports are ready to reuse. |
| RBAC | `ALREADY_IMPLEMENTED` | JWT/Keycloak sync, `require_roles`, CRM role constants, and ADMIN/KAM/MANAGER checks exist. |
| data scope | `PARTIAL` | Interaction/university read scope exists, but there is no reusable SQL scope builder for report queries yet. |
| audit | `ALREADY_IMPLEMENTED` | `audit_events`, `AuditService`, repository, request-id metadata, and existing file/import/workflow audit usage exist. |
| tests | `PARTIAL` | Existing tests cover access policy, auth, errors, files, imports, security, workflow. Stage 5 report/analytics/export/worker tests are missing. |

## Existing Infrastructure

### Docker Compose

`docker-compose.yml` currently defines:

- PostgreSQL
- backend
- MinIO
- MinIO bucket initialization
- Keycloak DB init
- frontend
- Keycloak

MinIO initialization already creates buckets:

- `workflow-files`
- `imports`
- `reports`

There is no Redis service and no worker service.

### Backend Dependencies

`backend/requirements.txt` currently includes FastAPI, SQLAlchemy, Alembic, PostgreSQL driver, MinIO, OpenPyXL, `xlrd`, `xlwt`, pytest and ruff.

Missing for later Stage 5 steps:

- Redis client / queue dependency.
- PDF exporter dependency, unless implemented with a dependency already present.

### Settings

`backend/app/core/config.py` already has:

- S3 settings.
- `s3_bucket_workflow_files`
- `s3_bucket_imports`
- `s3_bucket_reports`
- common file retention/upload limits.
- import-specific limits.

Missing for later Stage 5:

- report preview/export row limits.
- report job timeout/stale-running policy settings.
- report file retention setting if it differs from common file retention.
- Redis/queue settings.

### Database / Alembic

`backend/app/core/database.py` defines shared metadata, base model mixins, engine and session.

`backend/migrations/env.py` imports `app.models`, uses `Base.metadata`, and reads `settings.database_url`.

Existing migrations include CRM, roles/access scope, audit events, workflow versions/governance, object storage files, imports, and normalized contracts/licenses.

No Stage 5 report migration exists yet.

## Existing Data Model For Reports

### Interaction Dataset

`UniversityInteraction` contains:

- `university_id`
- `program_id`
- `product_id`
- `manager_user_id`
- workflow template/version/current stage links
- `status`
- legacy contract/license fields kept for backward compatibility
- `started_at`
- `completed_at`
- `comment`
- common timestamps from `ModelBase`

For "period of interactions", the most defensible current timestamp is `UniversityInteraction.started_at` because interaction creation explicitly defaults it to now in `UniversityInteractionService.create_interaction`. If Stage 5 needs a broader "record lifecycle" interpretation, `created_at`/`updated_at` are available, but the report filter semantics should be fixed in the architecture document before implementation.

### Catalog Joins

Available joins for canonical report rows:

- `university_interactions.university_id -> universities.id`
- `university_interactions.program_id -> it_programs.id`
- `it_programs.direction_id -> it_directions.id`
- `university_interactions.product_id -> it_products.id`
- `it_products.vendor_id -> vendors.id`
- `university_interactions.manager_user_id -> users.id`

### Contracts / Licenses

Normalized tables exist:

- `contracts`
- `licenses`

They are modeled in `backend/app/modules/licenses/model.py` and were added by migration `b7d9a2e1c4f6_add_contracts_licenses.py`.

Stage 5 should use these normalized tables for report columns when possible. Legacy contract/license fields on `university_interactions` should remain compatibility fields, not the primary report source.

### Workflow State

Workflow runtime data exists:

- `workflow_stage_instances`
- `workflow_stages`
- `workflow_transition_history`
- comments and attachments

`university_interactions.current_stage_instance_id` points to the current runtime stage instance. Report workflow columns can join through current stage instance to `workflow_stages`.

## RBAC And Data Scope

### Roles

Existing roles:

- `KAM`
- `MANAGER`
- `ADMIN`

`require_roles` enforces endpoint role access after JWT verification and user sync.

### KAM Scope

KAM users can see interactions where:

- `UniversityInteraction.manager_user_id == current_user.id`
- or explicit `data_access_scopes` grants access to a university/interaction.

### MANAGER Scope

MANAGER users can see interactions assigned to subordinate KAM users from active `manager_memberships`.

Explicit data access grants are also available for read checks, but the existing list endpoint scope primarily resolves manager filters through subordinate KAM ids.

### ADMIN Scope

ADMIN receives unrestricted administrative scope in existing access helpers.

### Reuse Requirement For Reports

Current scope helpers are useful but not yet shaped as a reusable SQL builder for a broad report query. Stage 5 should centralize report data scope in `ReportQueryService` or a helper called by it, so preview, exports, analytics and charts all use the same scoped dataset.

## Files / Storage Integration

### Storage

Existing storage components:

- `StorageAdapter`
- `S3CompatibleStorage`
- `get_storage_adapter`

Supported operations:

- `put`
- `get_stream`
- `delete`
- `stat`
- `presign_get`

### File Metadata And Lifecycle

`files` stores:

- provider/bucket/object key metadata
- checksum/size/mime/extension
- uploader
- scan status
- soft-delete fields
- retention/purge fields

`FileService` already supports streaming with audit, soft delete, restore and purge.

### Import Artifact Pattern

Imports already use:

```text
StorageAdapter -> files -> import_artifacts
```

Report artifacts should follow the same pattern:

```text
StorageAdapter -> files -> report_artifacts
```

Report files must use bucket `reports`.

## Audit / Errors / Request ID

### Audit

`audit_events` and `AuditService` exist. Existing modules write audit events for:

- interactions
- workflow changes/transitions
- file upload/download/delete/purge
- imports

Stage 5 should add report actions such as job creation, worker success/failure, artifact creation and artifact download.

### Error Envelope

`backend/app/common/errors.py` installs common handlers and produces a stable envelope:

```json
{
  "code": "...",
  "message": "...",
  "details": {},
  "requestId": "..."
}
```

Modules can pass structured HTTPException detail with `code`, `message`, and `details`.

### Request ID

The app sets or propagates `X-Request-ID` through middleware and exposes `get_request_id(request)` for audit/service calls.

## Existing Analytics / Reports API Surface

`backend/app/modules/analytics` exists but is only a skeleton:

- `router.py` defines `APIRouter(prefix="/analytics", tags=["analytics"])`
- service/repository/schema/model files contain placeholders only
- router is already included in `backend/app/api/router.py`

There is no `backend/app/modules/reports` module yet.

## Tests Audit

Existing unit tests cover:

- access policy
- auth dependencies
- error envelope
- file service
- health
- import hardening
- import mapping/parser
- security verifier
- workflow graph/governance/seed/transitions

Missing Stage 5 tests:

- `ReportFilter` validation
- `ReportQueryService` filters and sorting
- KAM/MANAGER/ADMIN report data scope
- preview count and rows
- exporter consistency with preview
- XLS/XLSX/PDF/JSON exporters
- report job lifecycle
- worker success/failure
- atomic artifact completion
- secure download authorization
- analytics consistency
- concurrent report jobs smoke

## Reuse Map

| Need | Existing code to reuse |
| --- | --- |
| Endpoint role checks | `app.modules.auth.dependencies.require_roles` |
| Role constants | `app.modules.auth.access.CRM_ROLES`, `ADMIN_ROLES` |
| Subordinate manager scope | `app.modules.auth.access.get_subordinate_kam_ids` |
| Existing read checks | `ensure_can_read_interaction`, `ensure_can_read_university` |
| Storage | `app.storage.StorageAdapter`, `get_storage_adapter` |
| File metadata/lifecycle | `app.modules.documents.model.File`, `FileService` |
| Artifact pattern | `ImportArtifact`, `ImportService.create_json_artifact` |
| Audit | `AuditEvent`, `AuditService`, `AuditEventRepository` |
| Error envelope | `app.common.errors` |
| Pagination/list shape | `app.common.repository.ListResult`, existing routers |
| Normalized contract/license data | `Contract`, `License` |

## Blockers / Risks For Next Steps

- Report data scope must not reuse only the current `list_with_manager_scope`, because reports also need explicit `data_access_scopes`, joins, aggregates and consistent count/preview/export datasets.
- The period filter semantics must be fixed before implementing `ReportFilter`. Recommended initial choice: `UniversityInteraction.started_at`.
- Redis and worker are absent and should be added only at the dedicated steps.
- PDF export will need an implementation choice and likely a dependency.
- `analytics` currently has an included empty router, so adding real endpoints must preserve consistent RBAC/data scope and not create independent SQL logic.

## STEP 0 Result

STEP 0 audit is complete.

Next required step from the Stage 5 prompt:

```text
STEP 1
Architecture document: docs/stage_5_be/stage5_reports_architecture.md
```

Do not implement exporters before the architecture document is accepted.

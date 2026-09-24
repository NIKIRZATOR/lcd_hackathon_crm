# Stage 5 Reports Architecture

Date: 2026-09-23

## Goal

Stage 5 adds backend reports, analytics and background report generation for CRM interactions.

Core rule:

```text
one filter DTO
  -> one scoped query layer
  -> one canonical dataset
  -> preview / exports / analytics / chart exports
```

Exporters and analytics must not build independent SQL with separate filtering logic.

## Source Audit

This architecture follows `docs/stage_5_be/stage5_reports_audit.md`.

Important audit outcomes:

- Redis and worker are missing.
- Report schema is missing.
- `backend/app/modules/analytics` exists but is an empty skeleton.
- Storage, files lifecycle, audit, request-id and RBAC already exist and must be reused.
- Normalized `contracts` and `licenses` exist and should be used for report data.

## Component Model

### ReportFilter

Single external DTO used by preview, report jobs, analytics and chart exports.

Logical fields:

```text
date_from
date_to

university_ids[]
direction_ids[]
program_ids[]
product_ids[]
responsible_user_ids[]

interaction_statuses[]
workflow_stage_ids[]

columns[]

sort_by
sort_direction
```

Period semantics:

- Initial report period should filter by `university_interactions.started_at`.
- Reason: interaction creation sets `started_at` to current timestamp when omitted, and it directly represents the business start of an interaction.
- `created_at` and `updated_at` remain technical lifecycle timestamps and should not be used for the default "interaction period" unless requirements change.

Validation rules:

- `date_from <= date_to` when both are present.
- `sort_direction` is `asc` or `desc`.
- `columns` and `sort_by` must be from the supported report column registry.
- Empty list filters mean "not restricted by this field".

### ReportColumn

Internal and API-visible column registry entry.

Recommended attributes:

```text
key
label
data_type
source
sortable
default_visible
exportable
```

Initial required columns:

- `university_name`
- `direction_name`
- `product_name`
- `interaction_status`
- `responsible_name`

Additional reusable CRM columns:

- `program_name`
- `vendor_name`
- `contract_number`
- `contract_signed_at`
- `contract_valid_from`
- `contract_valid_until`
- `license_number`
- `license_signed_at`
- `license_valid_until`
- `transfer_status`
- `workflow_stage_name`
- `workflow_stage_status`
- `comment`
- `started_at`
- `completed_at`
- `created_at`
- `updated_at`

### ReportRow

Canonical internal read model. This is not an ORM entity and should not be persisted.

Fields should only include values available from existing tables.

Initial canonical shape:

```text
interaction_id

university_id
university_name

direction_id
direction_name

program_id
program_name

product_id
product_name

vendor_id
vendor_name

contract_id
contract_number
contract_signed_at
contract_valid_from
contract_valid_until

license_id
license_number
license_signed_at
license_valid_until
transfer_status

responsible_user_id
responsible_name

interaction_status

workflow_stage_id
workflow_stage_name
workflow_stage_status

comment

started_at
completed_at
created_at
updated_at
```

If an interaction has multiple contracts or licenses, the query layer must define deterministic row expansion before exporters are implemented. Initial implementation can produce one row per interaction/product/license relation if this matches the current normalized data shape.

### ReportQueryService

Central Stage 5 read layer.

Responsibilities:

- Apply server-side RBAC/data scope.
- Apply report filters.
- Join only the data needed for canonical report rows.
- Provide count/preview/export/analytics input from the same base query.
- Enforce sort and column registry rules.
- Avoid N+1 ORM loading.

Recommended public methods:

```text
count(filter, current_user)
preview(filter, current_user, limit, offset)
fetch_rows(filter, current_user, limit=None, offset=None)
aggregate(filter, current_user)
get_columns()
```

Internal order:

```text
base interaction query
  -> apply user data scope
  -> apply filters
  -> apply joins/projection
  -> apply sorting
  -> map to ReportRow
```

Required data scope behavior:

- `ADMIN`: unrestricted administrative dataset.
- `MANAGER`: interactions assigned to active subordinate KAM users; explicit scopes must be considered where supported by existing policy.
- `KAM`: own interactions plus explicit university/interaction grants.

The service is the only place where report dataset SQL is built.

### ReportJob

Persistent async export job.

Planned table: `report_jobs`.

Recommended fields:

```text
id
status
format
filter_snapshot
columns_snapshot
created_by
created_at
updated_at
queued_at
started_at
finished_at
row_count
error_code
error_message
request_id
```

Statuses:

```text
QUEUED
RUNNING
DONE
FAILED
CANCELLED
```

The job stores snapshots of filters and selected columns so a later worker run is deterministic even if defaults change.

### ReportArtifact

Persistent link between a report job and generated file metadata.

Planned table: `report_artifacts`.

Recommended fields:

```text
id
report_job_id
file_id
artifact_type
format
row_count
created_at
```

Storage pattern:

```text
StorageAdapter -> files(bucket=reports) -> report_artifacts
```

`report_artifacts` must not store binary content directly.

### ReportWorker

Background process responsible for heavy exports.

Responsibilities:

- Pull job ids from Redis queue.
- Mark job `RUNNING`.
- Rehydrate `ReportFilter` from `filter_snapshot`.
- Run `ReportQueryService.fetch_rows`.
- Pass canonical `ReportRow` data to a `ReportExporter`.
- Store generated binary in bucket `reports` through `StorageAdapter`.
- Create `files` and `report_artifacts` records.
- Mark job `DONE` only after artifact creation succeeds.
- Mark job `FAILED` with stable error code on failures.
- Write audit events.

The API must not generate heavy report files inline.

### ReportExporter

Exporter interface that receives canonical rows and selected columns.

Expected implementations:

- XLSX
- XLS
- PDF
- JSON

Exporter rule:

```text
input: list/iterator of ReportRow + ReportColumn definitions
output: bytes/stream + mime type + extension
```

Exporters must not import ORM models or run SQL.

### AnalyticsService

Analytics layer built on top of `ReportQueryService`.

Responsibilities:

- Use the same `ReportFilter`.
- Use the same scoped canonical dataset or aggregate query derived by `ReportQueryService`.
- Return aggregation data for charts.

Initial aggregations:

- status distribution
- IT directions
- IT products
- universities
- responsible users
- dynamics over time

Analytics must not bypass data scope.

### ChartExportService

Service for exporting chart visualizations.

Initial output formats:

- PNG
- PDF

It should use data produced by `AnalyticsService`; it must not query CRM tables directly.

## Synchronous API Pipeline

```text
API
  -> require CRM roles
  -> validate ReportFilter
  -> ReportQueryService applies data scope
  -> ReportQueryService builds canonical dataset
  -> preview/count response
```

Preview response should include:

```text
rows
total
columns
limit
offset
```

Preview row limit must come from configuration, not hardcoded business logic.

## Asynchronous Export Pipeline

```text
POST report job
  -> validate ReportFilter and columns
  -> create report_jobs row with QUEUED
  -> enqueue job id in Redis
  -> return job metadata

worker
  -> dequeue job id
  -> mark RUNNING
  -> ReportQueryService.fetch_rows
  -> ReportExporter
  -> StorageAdapter
  -> MinIO reports bucket
  -> files row
  -> report_artifacts row
  -> mark DONE
```

Atomic completion rule:

- A job cannot become `DONE` before a valid `report_artifacts` row and corresponding `files` row exist.
- If storage succeeds but DB completion fails, worker cleanup/retry policy must prevent duplicate visible artifacts.

## Download Pipeline

```text
GET report artifact/download
  -> require CRM roles
  -> load report job and artifact
  -> verify current user can access the job/artifact
  -> FileService/StorageAdapter stream from reports bucket
  -> audit file/report download
```

Authorization policy:

- Job creator can read own job if their current data scope still allows it, or if the product policy accepts immutable generated artifacts.
- `ADMIN` can read all.
- `MANAGER` access must follow managed scope.
- `KAM` must not download another user's private report artifact unless explicitly allowed.

The exact immutable-vs-current-scope policy should be finalized before secure download implementation.

## API Surface

Planned reports endpoints:

```text
GET /api/reports/columns
POST /api/reports/preview
POST /api/reports
GET /api/reports
GET /api/reports/{job_id}
GET /api/reports/{job_id}/artifacts
GET /api/reports/artifacts/{artifact_id}/download
```

Planned analytics endpoints:

```text
POST /api/analytics/reports/summary
POST /api/analytics/reports/dynamics
POST /api/analytics/reports/charts/export
```

Endpoint names can be adjusted to fit existing router conventions during implementation.

## Storage And Lifecycle

Report binary artifacts:

- stored in MinIO/S3 bucket `reports`;
- represented by `files`;
- linked from `report_artifacts`;
- use existing file lifecycle fields: `deleted_at`, `delete_after`, `purged_at`;
- do not use permanent local filesystem storage.

Temporary files are allowed only as process-local transient exporter implementation details and must be deleted immediately.

## Audit Events

Recommended report audit actions:

```text
report.preview
report.job.created
report.job.started
report.job.completed
report.job.failed
report.artifact.created
report.artifact.downloaded
chart.exported
```

Audit metadata should include ids, format, row counts and stable error codes, but not raw report payloads.

## Error Codes

Recommended stable codes:

```text
REPORT_FILTER_INVALID
REPORT_COLUMN_INVALID
REPORT_SORT_INVALID
REPORT_TOO_MANY_ROWS
REPORT_JOB_NOT_FOUND
REPORT_JOB_NOT_READY
REPORT_JOB_FAILED
REPORT_ARTIFACT_NOT_FOUND
REPORT_ARTIFACT_FORBIDDEN
REPORT_EXPORT_FAILED
REPORT_QUEUE_UNAVAILABLE
```

All API errors should use the existing common error envelope.

## Configuration

Planned environment-backed settings:

```text
REDIS_URL
REPORT_PREVIEW_ROWS
REPORT_MAX_ROWS_XLS
REPORT_MAX_ROWS_XLSX
REPORT_MAX_ROWS_PDF
REPORT_MAX_ROWS_JSON
REPORT_JOB_TIMEOUT_SECONDS
REPORT_FILE_RETENTION_DAYS
REPORT_QUEUE_NAME
```

Values should be added when the corresponding implementation step needs them.

## Implementation Order

Follow the Stage 5 prompt order:

1. `ReportFilter`
2. `ReportRow`
3. `ReportQueryService`
4. query consistency/data-scope tests
5. Redis
6. worker
7. `ReportJob`
8. `ReportArtifact`
9. Report API
10. preview limits
11. exporters
12. worker lifecycle and atomic completion
13. secure download
14. analytics and chart export

Do not implement XLS/XLSX/PDF/JSON exporters before `ReportFilter`, `ReportRow`, `ReportQueryService` and consistency tests exist.

## Open Decisions

- Whether report artifact download authorization uses current data scope or immutable job ownership plus role policy.
- Exact row expansion policy when one interaction has multiple normalized contracts/licenses.
- PDF library choice.
- Redis queue library choice.
- Whether chart export rendering is backend-only or delegated to a later frontend/chart rendering layer.

## STEP 1 Result

The Stage 5 architecture is fixed enough to proceed to `STEP 2 - ReportFilter`.

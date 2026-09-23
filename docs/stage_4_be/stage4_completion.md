# Stage 4 Backend Completion

Дата: 2026-09-23

## Реализовано

- DB schema для import jobs, artifacts, mappings, mapping fields и row errors.
- Upload `.xls/.xlsx` через `/api/imports` с записью source в bucket `imports`.
- Preview spreadsheet headers/sample rows без изменения CRM-таблиц.
- Target field registry и системный preset `RTK_DEFAULT_V1`.
- Mapping API и immutable job mapping snapshot.
- Validation engine с row errors.
- Diff с `CREATE`, `UPDATE`, `SKIP`, `CONFLICT`.
- Confirm с transactional apply и guard rails.
- ADMIN-only RBAC для import endpoints.
- Audit events для import lifecycle.
- Unit tests для XLS/XLSX parser и mapping validation.
- Clean Docker verification, Alembic upgrade/check и API smoke для `.xlsx`/`.xls`.
- Stage 4.1 hardening: normalized `contracts/licenses`, stale diff protection, concurrent confirm guard, import limits, sheet/header config, protocol/error artifacts.

## Измененные файлы

- `backend/app/modules/imports/*` - новый backend-модуль Stage 4.
- `backend/app/api/router.py` - подключен imports router.
- `backend/app/models.py` - import models подключены к Alembic metadata.
- `backend/app/core/config.py` - `DEBUG=release` корректно парсится как non-debug окружение.
- `backend/app/core/security.py` - token verifier принимает внешний и internal Keycloak issuer.
- `backend/scripts/seed_demo_data.py` - demo user full names синхронизированы с Keycloak realm.
- `backend/requirements.txt` - добавлены `openpyxl`, `xlrd`, `xlwt`.
- `backend/migrations/versions/a6e4c2f8b9d0_add_import_jobs.py` - schema Stage 4.
- `backend/migrations/versions/b7d9a2e1c4f6_add_contracts_licenses.py` - normalized contracts/licenses и data migration.
- `backend/tests/unit/test_import_parser.py` - parser tests.
- `backend/tests/unit/test_import_mapping.py` - mapping tests.
- `docs/db_architecture.md` - import tables/API/audit documented.

## Migration

- `a6e4c2f8b9d0_add_import_jobs.py`
  - создает `import_jobs`;
  - создает `import_artifacts`;
  - создает `import_mappings`;
  - создает `import_mapping_fields`;
  - создает `import_row_errors`;
  - добавляет FK, unique constraints и индексы.

## Endpoints

- `POST /api/imports`
- `GET /api/imports`
- `GET /api/imports/{job_id}`
- `GET /api/imports/{job_id}/preview`
- `GET /api/imports/fields`
- `GET /api/imports/mappings`
- `POST /api/imports/mappings`
- `GET /api/imports/{job_id}/mapping`
- `PUT /api/imports/{job_id}/mapping`
- `POST /api/imports/{job_id}/validate`
- `GET /api/imports/{job_id}/errors`
- `GET /api/imports/{job_id}/diff`
- `POST /api/imports/{job_id}/confirm`

## Ограничения

- Frontend import UI не реализовывался.
- Redis/worker не добавлялись.
- Reports, LMS/CMS integrations, AI/fuzzy matching не добавлялись.
- Отдельный worker/background execution для больших import-файлов не добавлялся.
- ClamAV не реализован; это production security blocker до внешнего/customer deployment.

## Итоговый статус

Stage 4 Backend можно считать завершённым.

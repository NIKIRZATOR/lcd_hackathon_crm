# Stage 3 Backend Verification

Дата: 2026-09-22

## Выполненные команды

### Compile

```bash
python -m compileall backend\app\modules\documents backend\app\modules\workflows\router.py backend\app\modules\workflows\service.py backend\app\core\config.py backend\scripts\purge_deleted_files.py
```

Результат: успешно.

### Docker Compose Config

```bash
docker compose config
```

Результат: успешно.

В итоговом config проверены:

- `minio`
- `minio-init`
- `minio_data`
- backend S3 env
- buckets `workflow-files`, `imports`, `reports`

### Clean Docker Start

```bash
docker compose down -v
docker compose up --build
docker compose ps
```

Результат: успешно.

Фактически подтверждено:

- PostgreSQL пересоздан с пустого volume и стал healthy.
- MinIO пересоздан с пустого volume и стал healthy.
- `minio-init` завершился успешно.
- Backend стартовал на `0.0.0.0:8000`.
- Frontend стартовал на `0.0.0.0:5173`.
- Keycloak импортировал realm и стартовал на `0.0.0.0:8080`.

Backend health:

```bash
Invoke-WebRequest -Uri http://localhost:8000/api/health -UseBasicParsing
```

Результат:

```json
{"status":"ok","service":"backend"}
```

Smoke-проверка buckets:

```bash
docker compose run --rm --entrypoint /bin/sh minio-init -c "mc alias set local http://minio:9000 rtk_eduflow_minio rtk_eduflow_minio_secret; mc ls local"
```

Результат:

```text
imports/
reports/
workflow-files/
```

### Unit tests в Docker

```bash
docker compose run --rm backend pytest tests/unit/test_file_service.py
```

Результат: успешно.

```text
5 passed
```

```bash
docker compose run --rm backend pytest tests/unit/test_transition_service.py
```

Результат: успешно.

```text
5 passed, 1 warning
```

### Ruff в Docker

```bash
docker compose run --rm backend ruff check app/modules/documents app/modules/workflows/router.py app/modules/workflows/service.py app/core/config.py scripts/purge_deleted_files.py tests/unit/test_file_service.py
```

Результат: успешно.

```text
All checks passed!
```

### Alembic Upgrade в Docker

```bash
docker compose run --rm backend alembic upgrade head
```

Результат: успешно.

```text
Context impl PostgresqlImpl.
Will assume transactional DDL.
```

### Alembic Check в Docker

```bash
docker compose run --rm backend alembic check
```

Результат: успешно.

```text
No new upgrade operations detected.
```

Примечание: один запуск `alembic check` был случайно начат параллельно с `alembic upgrade head` на свежесозданной БД и упал из-за race condition вокруг `alembic_version`. После последовательного запуска `upgrade`, а затем `check`, проверка прошла успешно.

### Full Pytest в Docker

```bash
docker compose run --rm backend pytest
```

Результат: успешно.

```text
42 passed, 1 warning
```

### Full Ruff в Docker

```bash
docker compose run --rm backend ruff check .
```

Результат: успешно.

```text
All checks passed!
```

## Локальные команды, заблокированные окружением

### Local Ruff

```bash
python -m ruff check ...
ruff check ...
```

Результат: заблокировано локальным Python environment.

```text
No module named ruff
The term 'ruff' is not recognized
```

### Local Pytest

```bash
python -m pytest backend\tests\unit\test_file_service.py
python -m pytest backend\tests\unit\test_transition_service.py
```

Результат: заблокировано локальным Python environment.

Первый blocker:

```text
DEBUG=release cannot be parsed as bool
```

После override `DEBUG=false` второй blocker:

```text
ImportError: no pq wrapper available
```

Те же tests проходят внутри backend container.

## Manual smoke checklist

Manual/API storage smoke test выполнен:

1. Authorize как `kam1`.
2. Upload PDF/DOCX/XLSX в доступный stage instance.
3. Проверить, что object существует в MinIO bucket `workflow-files`.
4. Проверить, что metadata есть в `files`.
5. Проверить, что relation есть в `workflow_stage_attachments`.
6. Download через backend.
7. Soft delete.
8. Проверить, что обычный list/download больше не возвращает file.
9. Restore.
10. Проверить, что attachment снова появился.
11. Выставить `delete_after` в прошлое и запустить purge command.
12. Проверить object removal и `purged_at`.

## API storage smoke test

Seed data:

```bash
docker compose run --rm backend python scripts/seed_demo_data.py
```

Результат:

```text
Demo data seeded.
```

Token:

```bash
POST http://localhost:8080/realms/rtk-eduflow/protocol/openid-connect/token
username=kam1
password=kam1
client_id=rtk-eduflow-frontend
grant_type=password
```

Результат: access token получен.

Использованный stage instance:

```text
b9a1c2ef-5370-495c-928e-981cfee7a0d0
```

Upload:

```bash
POST /api/workflows/stage-instances/b9a1c2ef-5370-495c-928e-981cfee7a0d0/attachments
```

Результат: успешно.

```text
attachment_id=c53465f3-56c7-44e1-b602-ed03cd55d3a2
file_id=a0aa084e-0980-4fd9-8487-b22fb3e0f388
checksum=39677cb1eb2e037dd2b99a4f2bf444023681b5d770da65790481459714bc6852
scan_status=NOT_SCANNED
```

List:

```bash
GET /api/workflows/stage-instances/b9a1c2ef-5370-495c-928e-981cfee7a0d0/attachments
```

Результат: успешно, uploaded attachment вернулся в ответе.

Download:

```bash
GET /api/workflows/attachments/c53465f3-56c7-44e1-b602-ed03cd55d3a2/download
```

Результат: успешно.

```text
HTTP 200
```

MinIO object stat:

```bash
mc stat local/workflow-files/interactions/2ef227bf-0afb-42f8-a325-03368e29e893/stages/b9a1c2ef-5370-495c-928e-981cfee7a0d0/1d87076e-ebb0-4b81-bfd4-2c378aa65a24.pdf
```

Результат: успешно.

```text
Size: 14 B
Content-Type: application/pdf
```

Soft delete:

```bash
DELETE /api/workflows/attachments/c53465f3-56c7-44e1-b602-ed03cd55d3a2
```

Результат: успешно.

Restore:

```bash
POST /api/workflows/attachments/c53465f3-56c7-44e1-b602-ed03cd55d3a2/restore
```

Результат: успешно.

Purge:

```bash
DELETE /api/workflows/attachments/c53465f3-56c7-44e1-b602-ed03cd55d3a2
docker compose exec -T postgres psql -U rtk_eduflow -d rtk_eduflow -c "update files set delete_after = now() - interval '1 minute' where id = 'a0aa084e-0980-4fd9-8487-b22fb3e0f388';"
docker compose run --rm backend python scripts/purge_deleted_files.py --limit 10
```

Результат: успешно.

```text
Purged files: 1
purged_at is not null: true
MinIO stat after purge: Object does not exist
```

## Текущий verification status

Успешно:

- Python compilation для измененных backend files.
- Docker Compose configuration rendering.
- Full clean Docker start.
- Backend health check.
- MinIO bucket creation smoke check.
- New file lifecycle service unit tests в Docker.
- Existing workflow transition tests в Docker.
- Ruff на измененных backend files в Docker.
- Alembic upgrade head в Docker.
- Alembic check в Docker.
- Full backend pytest в Docker.
- Full backend ruff в Docker.

Pending:

- Нет pending automated Stage 3 backend verification checks в этом проходе.

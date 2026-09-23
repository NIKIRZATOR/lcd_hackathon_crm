# Stage 4 Backend Verification

Дата: 2026-09-23

## Local checks

```powershell
python -m compileall app
```

Результат: успешно.

```powershell
python -m ruff check .
```

Результат: `All checks passed!`

```powershell
python -m pytest tests\unit
```

Результат: `50 passed, 1 warning`.

## Clean Docker checks

```powershell
docker compose down -v
```

Результат: clean project volumes удалены.

```powershell
docker compose up --build -d postgres minio minio-init backend keycloak-db-init keycloak
```

Результат: backend image собран, PostgreSQL/MinIO/Keycloak/backend подняты на clean volumes.

```powershell
docker compose run --rm backend alembic upgrade head
```

Результат: успешно применены все migrations до `a6e4c2f8b9d0`.

```powershell
docker compose run --rm backend alembic check
```

Результат: `No new upgrade operations detected.`

```powershell
docker compose run --rm backend python scripts/seed_demo_data.py
```

Результат: `Demo data seeded.`

```powershell
docker compose run --rm backend pytest tests/unit
```

Результат: `50 passed, 1 warning`.

```powershell
docker compose run --rm backend ruff check .
```

Результат: `All checks passed!`

## API smoke

Проведен реальный smoke через `http://localhost:8000/api`:

```text
auth as ADMIN
upload .xlsx
preview
mapping
validate
diff
confirm
upload .xls
preview
mapping
validate
diff
confirm
```

Результаты:

- `.xlsx`: upload `201`, preview `200`, mapping `200`, validate `200`, diff `200`, confirm `200`, final status `DONE`.
- `.xls`: upload `201`, preview `200`, mapping `200`, validate `200`, diff `200`, confirm `200`, final status `DONE`.
- preview returned Cyrillic headers and sample rows; console output displayed mojibake because of Windows shell encoding, but JSON assertions used the actual Cyrillic values.
- repeated identical `.xlsx` import produced `create_count=0`, `update_count=0`, `skip_count=2`, `conflict_count=0`.
- double confirm returned `409 IMPORT_ALREADY_CONFIRMED`.
- `KAM` and `MANAGER` access to imports returned `403`.

## PostgreSQL and MinIO verification

Command:

```powershell
docker compose run --rm backend python -c "<query import_jobs/files/import_artifacts/audit_events and storage.stat()>"
```

Result:

```text
jobs=7
done=5
artifacts=7
import_files=7
audit_events=36
sample storage.stat objects:
- bucket=imports, object_key=imports/<job_id>/<uuid>.xlsx, size=5356
- bucket=imports, object_key=imports/<job_id>/<uuid>.xls, size=5632
```

The extra non-DONE jobs are from negative/debug smoke attempts during verification; successful `.xlsx`, `.xls`, and idempotency jobs are `DONE`.

## Notes

Local host Python is 3.13, while Docker uses Python 3.12. The project `requirements.txt` installs cleanly in Docker. Local `python -m pip install -r requirements.txt` on Python 3.13 cannot install pinned `psycopg-binary==3.2.1`, so authoritative Alembic/Docker verification was performed inside the project Docker backend container.

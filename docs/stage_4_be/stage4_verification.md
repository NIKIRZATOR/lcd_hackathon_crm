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

Результат: `61 passed, 1 warning`.

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

Результат: успешно применены все migrations до `b7d9a2e1c4f6`.

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

Результат: `61 passed, 1 warning`.

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
- stale diff scenario returned `409 IMPORT_STALE_DIFF`.
- forced rollback scenario returned `IMPORT_APPLY_FAILED`, job became `FAILED`, no partial university remained, `import.fail` and `PROTOCOL` artifact were created.
- concurrent confirm scenario returned one `DONE` and one `409 IMPORT_STALE_DIFF`; PostgreSQL contained exactly one `Concurrent University`.
- double confirm returned `409 IMPORT_ALREADY_CONFIRMED`.
- `KAM` and `MANAGER` access to imports returned `403`.

## PostgreSQL and MinIO verification

Command:

```powershell
docker compose run --rm backend python -c "<query import_jobs/files/import_artifacts/audit_events and storage.stat()>"
```

Result:

```text
contracts=6
licenses=6
protocols=5
error_reports=0
import_files=13
concurrent_universities=1
sample storage.stat objects:
- bucket=imports, object_key=imports/<job_id>/<uuid>.xlsx, size=5356
- bucket=imports, object_key=imports/<job_id>/<uuid>.xls, size=5632
```

Successful `.xlsx`, `.xls`, idempotency, stale-diff, rollback, and concurrent-confirm scenarios were verified on clean Docker volumes after applying migrations.

## Notes

Local host Python is 3.13, while Docker uses Python 3.12. The project `requirements.txt` installs cleanly in Docker. Local `python -m pip install -r requirements.txt` on Python 3.13 cannot install pinned `psycopg-binary==3.2.1`, so authoritative Alembic/Docker verification was performed inside the project Docker backend container.

# Stage 4.1 Backend Hardening

Дата: 2026-09-23

## 1. Audit исходного состояния

| Пункт | Статус до Stage 4.1 | Итог |
| --- | --- | --- |
| Import pipeline | `ALREADY_IMPLEMENTED` | Сохранен без переписывания. |
| `ImportJob` / artifacts / mappings / row errors | `ALREADY_IMPLEMENTED` | Расширены artifacts и config. |
| Contracts/licenses | `PARTIAL` | Были flattened поля в `university_interactions`; добавлены normalized `contracts` и `licenses`. |
| Business keys | `PARTIAL` | Зафиксированы и использованы в diff/apply. |
| Stale diff protection | `MISSING` | Добавлены input/mapping/CRM fingerprints. |
| Concurrent confirm | `PARTIAL` | Добавлены PostgreSQL advisory transaction locks per business key. |
| Transaction rollback | `PARTIAL` | Проверен forced rollback smoke; job -> `FAILED`. |
| Import limits | `MISSING` | Добавлены config/env limits. |
| Sheet/header selection | `PARTIAL` | Добавлен `PATCH /api/imports/{job_id}/config`. |
| Protocol/error artifacts | `MISSING` | Добавлены JSON `PROTOCOL` и `ERROR_REPORT`. |
| File lifecycle | `PARTIAL` | Import files/artifacts используют `files.delete_after` и общий lifecycle metadata. |
| Antivirus readiness | `PARTIAL` | `scan_status` не обходится, ClamAV не добавлен; production blocker задокументирован. |
| Attachment allowlist | `PARTIAL` | Расширен до ТЗ: png/jpeg/pdf/zip/gzip/rar/doc/docx/xls/xlsx. |
| Keycloak issuer verification | `PARTIAL` | Добавлены tests external/internal issuer allowlist and invalid token cases. |
| Error envelope/request-id | `ALREADY_IMPLEMENTED` | Существующий общий envelope сохранен. |
| CI | `PARTIAL` | Backend CI расширен PostgreSQL service + Alembic upgrade/check. |

## 2. Contracts / Licenses Migration Strategy

Добавлены таблицы:

```text
contracts(id, interaction_id, number, signed_at, valid_from, valid_until, status, created_at, updated_at)
licenses(id, contract_id, product_id, license_number, signed_at, valid_until, transfer_status, created_at, updated_at)
```

Migration `b7d9a2e1c4f6_add_contracts_licenses.py`:

- создает normalized tables;
- копирует существующие `university_interactions.contract_number`, `license_signed_at`, `license_valid_until`, `transfer_status`;
- не удаляет legacy columns.

Legacy columns остаются deprecated для backward compatibility текущего Interactions API. Importer Stage 4.1 пишет normalized `contracts/licenses` и синхронно поддерживает legacy fields.

## 3. Business Keys

| Entity | Business key | Normalization | 0 matches | 1 match | >1 matches |
| --- | --- | --- | --- | --- | --- |
| University | `name` | trim + casefold | create on apply | use | conflict/validation ambiguity |
| Vendor | `name` | trim + casefold | create on apply | use | conflict/validation ambiguity |
| Product | `name` | trim + casefold | create on apply | use | conflict/validation ambiguity |
| Contract | `(interaction_id, number)` | trim | create on apply | update | conflict |
| License | `(contract_id, product_id)` | UUID pair | create/update | update | prevented by unique constraint |
| Interaction | `(university_id, product_id, contract.number)` | exact ids + trim | create | update/skip | conflict |
| Manager | `email` preferred, else `full_name` | trim + casefold | validation error | use | validation error |
| UniversityContact | imported as text in `university_responsibles` | trim | stored as text | stored as text | no automatic merge |

Fuzzy matching, AI matching and `first()` matching are not used for production apply decisions.

## 4. Stale Diff Strategy

Diff snapshot now stores:

- `input_hash`;
- `mapping_hash`;
- `crm_fingerprint`;
- diff items.

Before confirm, backend:

1. locks all business keys with transaction advisory locks;
2. recalculates input hash;
3. recalculates mapping hash;
4. recalculates relevant CRM fingerprint;
5. rejects with `409 IMPORT_STALE_DIFF` if any value changed.

## 5. Concurrency Strategy

Confirm uses PostgreSQL transaction advisory locks:

```text
pg_advisory_xact_lock(hashtext('import:' || business_key))
```

Locks are per imported business key, not global DB locks. Concurrent imports touching different business keys can proceed independently.

## 6. Import Limits

Added settings:

```text
IMPORT_MAX_UPLOAD_BYTES
IMPORT_MAX_ROWS
IMPORT_MAX_COLUMNS
IMPORT_MAX_SHEETS
IMPORT_PREVIEW_ROWS
IMPORT_FILE_RETENTION_DAYS
```

Stable error codes:

- `IMPORT_FILE_TOO_LARGE`;
- `IMPORT_TOO_MANY_ROWS`;
- `IMPORT_TOO_MANY_COLUMNS`;
- `IMPORT_TOO_MANY_SHEETS`.

## 7. Sheet/Header Config

Added:

```http
PATCH /api/imports/{job_id}/config
```

Payload:

```json
{
  "sheet_name": "Каталог",
  "header_row": 2
}
```

Changing config invalidates mapping snapshot, validation errors, diff snapshot and counters.

## 8. Import Artifacts

Artifacts:

- `SOURCE` - original XLS/XLSX;
- `ERROR_REPORT` - JSON rows with validation errors;
- `PROTOCOL` - JSON protocol after `DONE` or `FAILED`.

Artifacts are stored through:

```text
StorageAdapter -> files -> import_artifacts
```

No permanent local filesystem storage is used.

## 9. Security Review

Keycloak verifier:

- verifies JWT signature through JWKS;
- verifies expiry;
- verifies audience;
- verifies issuer against explicit allowlist: external issuer and internal Docker issuer;
- does not disable signature verification;
- rejects unknown issuer, wrong audience, expired token and invalid signature.

Attachment upload:

- allowlist expanded to ТЗ formats;
- extension, MIME and reasonable file signatures are checked;
- archives are not unpacked.

Antivirus:

- import/file metadata still uses `scan_status`;
- ClamAV is not implemented in Stage 4.1;
- this remains a production security blocker before public/customer deployment.

## 10. Tests

Added/extended tests:

- parser limit test;
- stale diff guard test;
- advisory lock test;
- attachment allowlist/signature tests;
- Keycloak issuer/security tests.

Docker smoke additionally verified:

- XLSX import;
- XLS import;
- repeated import idempotency;
- stale diff scenario;
- forced rollback scenario;
- concurrent confirm scenario;
- PostgreSQL and MinIO state.

## 11. Remaining Limitations

- ClamAV/quarantine scanning is not implemented.
- No Redis/worker/background processing; imports remain synchronous with explicit limits.
- Real customer XLS/XLSX profiling remains `WAIT_DATA`.
- UniversityContact normalized upsert is intentionally not automated; imported contact text is kept in `university_responsibles`.

## 12. Status

Stage 4.1 Backend Hardening можно считать завершенным для текущего backend scope.

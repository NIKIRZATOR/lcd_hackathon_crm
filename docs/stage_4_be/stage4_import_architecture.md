# Stage 4 Backend Import Architecture

Дата: 2026-09-23

## Pipeline

```text
ADMIN
  -> POST /api/imports
  -> GET /api/imports/{job_id}/preview
  -> PUT /api/imports/{job_id}/mapping
  -> POST /api/imports/{job_id}/validate
  -> GET /api/imports/{job_id}/diff
  -> POST /api/imports/{job_id}/confirm
```

До `confirm` основные CRM-таблицы не меняются. Upload создает `import_jobs`, `files` и `import_artifacts`; preview, mapping, validation и diff работают как подготовительные операции.

## Tables

- `import_jobs` хранит lifecycle, counters, mapping snapshot, diff snapshot и ссылки на source file.
- `import_artifacts` связывает job с `files`; сейчас используется `SOURCE`, предусмотрены `ERROR_REPORT` и `PROTOCOL`.
- `import_mappings` и `import_mapping_fields` хранят переиспользуемые mappings.
- `import_row_errors` хранит структурированные ошибки строк validation.
- `files` остается единственным источником metadata для object storage.
- `contracts` и `licenses` хранят normalized contract/license data; legacy interaction fields временно сохранены как deprecated compatibility fields.

## Storage

Source spreadsheets пишутся через существующий `StorageAdapter` в bucket `imports`.

Object key строится безопасно:

```text
imports/<import_job_id>/<uuid>.<ext>
```

Пользовательский filename сохраняется только как `files.original_name`.

## Parser

Реализованы reader-ы:

- `XlsxSpreadsheetReader` на `openpyxl`, `data_only=True`;
- `XlsSpreadsheetReader` на `xlrd` для legacy BIFF `.xls`.

Проверки формата:

- `.xlsx`: ZIP signature `PK`;
- `.xls`: OLE Compound signature `D0 CF 11 E0 A1 B1 1A E1`.

Backend не исполняет формулы, макросы или embedded scripts.

## Mapping

Target field registry включает поля:

- `university.name`;
- `vendor.name`;
- `product.name`;
- `direction.name`;
- `program.name`;
- `contract.number`;
- `license.signed_at`;
- `license.valid_until`;
- `license.transfer_status`;
- `manager.full_name`;
- `manager.email`;
- `university_contact.full_name`;
- `interaction.comment`.

Системный preset `RTK_DEFAULT_V1` покрывает стандартные заголовки ТЗ. При установке mapping на job сохраняется immutable `mapping_snapshot`.

## Validation

Validation выполняется повторяемо: старые `import_row_errors` удаляются перед новым запуском.

Проверяются:

- unknown target fields;
- missing required mapping/columns;
- empty required fields;
- invalid dates/years;
- manager not found / ambiguous;
- ambiguous catalog references.

Ошибки бизнес-данных строк не переводят job в `FAILED`; они сохраняются в `import_row_errors`.

## Diff

Diff строит row actions:

- `CREATE`;
- `UPDATE`;
- `SKIP`;
- `CONFLICT`.

Система предпочитает `CONFLICT` неоднозначному merge. Fuzzy/AI matching не используется.

Diff snapshot содержит `input_hash`, `mapping_hash` и `crm_fingerprint`. Confirm пересчитывает эти значения и возвращает `409 IMPORT_STALE_DIFF`, если данные устарели.

## Confirm

`confirm` запрещен, если:

- validation errors не устранены;
- есть unresolved conflicts;
- job уже confirmed;
- diff не построен.

Apply выполняет transactional upsert в существующую CRM schema:

- `universities`;
- `vendors`;
- `it_products`;
- `university_interactions`.
- `contracts`;
- `licenses`.

Contract/license данные сохраняются в normalized tables. Legacy поля `university_interactions.contract_number`, `license_signed_at`, `license_valid_until`, `transfer_status`, `university_responsibles`, `comment` обновляются для backward compatibility.

Confirm берет PostgreSQL advisory transaction locks per business key, чтобы concurrent imports не создавали duplicates/lost updates.

## Audit

Реализованные actions:

- `import.upload`;
- `import.mapping.update`;
- `import.validate`;
- `import.diff`;
- `import.confirm`;
- `import.complete`;
- `import.fail`.

Audit metadata содержит counters, ids и checksum, но не хранит spreadsheet rows целиком.

# Stage 4 Backend Manual Check

Дата: 2026-09-23

Этот документ описывает, как вручную проверить работоспособность Stage 4 Backend: импорт XLS/XLSX, mapping, validation, diff, confirm, RBAC, PostgreSQL и MinIO.

## 1. Поднять clean окружение

Из корня проекта:

```powershell
docker compose down -v
docker compose up --build -d postgres minio minio-init backend keycloak-db-init keycloak
```

Проверить миграции:

```powershell
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend alembic check
```

Ожидаемый результат:

```text
No new upgrade operations detected.
```

Засеять demo data:

```powershell
docker compose run --rm backend python scripts/seed_demo_data.py
```

Ожидаемый результат:

```text
Demo data seeded.
```

## 2. Открыть Swagger

Открыть в браузере:

```text
http://localhost:8000/docs
```

Нажать `Authorize`.

Использовать:

```text
username: admin1
password: admin1
```

Проверить:

```http
GET /api/auth/me
```

Ожидаемо: пользователь с ролью `ADMIN`.

## 3. Подготовить XLSX

Создать файл `.xlsx` с листом и колонками:

```text
Название ВУЗа
Вендор
ПО
ИТ-программа
Номер договора
Подписание лицензии
Срок действия лицензии (год)
Статус по передачи
ФИО Менеджера
Ответственные от ВУЗа
Комментарий
```

Пример строки для UPDATE существующего interaction:

```text
ITMO University
RTK Data
ML Studio
Applied Machine Learning
RTK-DEMO-002
2026-09-23
2027
TRANSFERRED
KAM User
Anna Petrova
Manual Stage 4 update
```

Пример строки для CREATE нового interaction:

```text
Stage 4 Manual University
RTK Data
ML Studio
Applied Machine Learning
RTK-MANUAL-001
2026-09-23
2027
IN_PROGRESS
KAM User
Manual Contact
Manual Stage 4 create
```

## 4. Проверить основной сценарий через Swagger

### 4.1 Upload

В Swagger выполнить:

```http
POST /api/imports
```

Передать multipart file `.xlsx`.

Ожидаемо:

```text
201 Created
status = UPLOADED
source_file_id != null
```

Сохранить `id` import job.

### 4.2 Preview

```http
GET /api/imports/{job_id}/preview
```

Ожидаемо:

- возвращаются `sheetNames`;
- видны headers;
- видны sample rows;
- кириллица в headers читается корректно;
- CRM-таблицы еще не изменены.

### 4.3 Fields

```http
GET /api/imports/fields
```

Ожидаемо есть target fields:

```text
university.name
vendor.name
product.name
program.name
contract.number
license.signed_at
license.valid_until
license.transfer_status
manager.full_name
university_contact.full_name
interaction.comment
```

### 4.4 Mapping

Выполнить:

```http
PUT /api/imports/{job_id}/mapping
```

Payload:

```json
{
  "fields": [
    {"source_column": "Название ВУЗа", "target_field": "university.name", "required": true},
    {"source_column": "Вендор", "target_field": "vendor.name", "required": true},
    {"source_column": "ПО", "target_field": "product.name", "required": true},
    {"source_column": "ИТ-программа", "target_field": "program.name"},
    {"source_column": "Номер договора", "target_field": "contract.number"},
    {"source_column": "Подписание лицензии", "target_field": "license.signed_at"},
    {"source_column": "Срок действия лицензии (год)", "target_field": "license.valid_until"},
    {"source_column": "Статус по передачи", "target_field": "license.transfer_status"},
    {"source_column": "ФИО Менеджера", "target_field": "manager.full_name"},
    {"source_column": "Ответственные от ВУЗа", "target_field": "university_contact.full_name"},
    {"source_column": "Комментарий", "target_field": "interaction.comment"}
  ]
}
```

Ожидаемо:

```text
200 OK
status у job = MAPPED
```

### 4.5 Validation

```http
POST /api/imports/{job_id}/validate
```

Ожидаемо для корректного файла:

```text
status = READY
invalid_rows = 0
valid_rows > 0
```

Если есть ошибки:

```http
GET /api/imports/{job_id}/errors
```

Ожидаемый формат ошибки:

```json
{
  "row": 2,
  "column": "ФИО Менеджера",
  "targetField": "manager.full_name",
  "code": "MANAGER_NOT_FOUND",
  "message": "Manager not found"
}
```

### 4.6 Diff

```http
GET /api/imports/{job_id}/diff
```

Ожидаемо:

```text
CREATE / UPDATE / SKIP / CONFLICT
```

Для примера выше ожидаемо примерно:

```text
create_count >= 1
update_count >= 1
conflict_count = 0
```

### 4.7 Confirm

```http
POST /api/imports/{job_id}/confirm
```

Ожидаемо:

```text
200 OK
status = DONE
```

Повторный confirm должен вернуть:

```text
409 IMPORT_ALREADY_CONFIRMED
```

## 5. Проверить XLS

Повторить пункты 4.1-4.7 для настоящего legacy `.xls`, не переименованного `.xlsx`.

Ожидаемо:

```text
upload -> preview -> mapping -> validate -> diff -> confirm
status = DONE
```

Если переименовать `.xlsx` в `.xls`, upload должен быть отклонен:

```text
IMPORT_INVALID_FORMAT
```

## 6. Проверить idempotency

Загрузить тот же `.xlsx` второй раз.

Пройти:

```text
upload -> preview -> mapping -> validate -> diff
```

Ожидаемо:

```text
create_count = 0
update_count = 0
conflict_count = 0
skip_count = количество строк данных
```

После confirm дубли в CRM не должны появиться.

## 7. Проверить RBAC

В Swagger перелогиниться как:

```text
kam1 / kam1
```

Выполнить:

```http
GET /api/imports/fields
```

Ожидаемо:

```text
403 Forbidden
```

Повторить для:

```text
manager1 / manager1
```

Ожидаемо:

```text
403 Forbidden
```

## 8. Проверить PostgreSQL и MinIO

Выполнить:

```powershell
docker compose run --rm backend python -c "from app.core.database import SessionLocal; from app.modules.imports.model import ImportJob, ImportArtifact; from app.modules.documents.model import File; from app.modules.audit.model import AuditEvent; from app.storage import get_storage_adapter; db=SessionLocal(); storage=get_storage_adapter(); files=db.query(File).filter(File.bucket=='imports').all(); stats=[(f.original_name,f.bucket,f.object_key,storage.stat(bucket=f.bucket,object_key=f.object_key).size) for f in files[:3]]; print({'jobs':db.query(ImportJob).count(),'done':db.query(ImportJob).filter(ImportJob.status=='DONE').count(),'artifacts':db.query(ImportArtifact).count(),'import_files':len(files),'audit_events':db.query(AuditEvent).filter(AuditEvent.action.like('import.%')).count(),'sample_stats':stats}); db.close()"
```

Ожидаемо:

```text
jobs > 0
done > 0
artifacts > 0
import_files > 0
audit_events > 0
sample_stats contains bucket=imports and object_key=imports/<job_id>/<uuid>.<ext>
```

## 9. Проверить regression tests

```powershell
docker compose run --rm backend pytest tests/unit
docker compose run --rm backend ruff check .
```

Ожидаемо:

```text
50 passed
All checks passed!
```

## 10. Критерии успешной проверки

Stage 4 Backend можно считать рабочим, если:

- `.xlsx` import проходит до `DONE`;
- `.xls` import проходит до `DONE`;
- preview показывает headers и строки;
- validation возвращает структурированные ошибки;
- diff показывает `CREATE`, `UPDATE`, `SKIP`, `CONFLICT`;
- confirm запрещен при validation errors/conflicts;
- повторный импорт не создает дубли;
- KAM/MANAGER получают `403`;
- PostgreSQL содержит `files`, `import_jobs`, `import_artifacts`;
- MinIO реально содержит source objects в bucket `imports`;
- `alembic upgrade head`, `alembic check`, `pytest`, `ruff` проходят.

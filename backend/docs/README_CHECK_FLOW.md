# Проверка реализованного backend flow

Короткая инструкция для проверки того, что было сделано в рамках текущего этапа: БД V1, CRUD справочников, demo data, `university_interactions` и runtime workflow.

## 1. Запустить backend

Из корня проекта:

```powershell
docker compose up -d postgres backend
```

Swagger:

```text
http://localhost:8000/docs
```

Healthcheck:

```text
http://localhost:8000/api/health
```

## 2. Применить миграции

```powershell
docker compose run --rm backend alembic upgrade head
```

Проверить, что Alembic не видит новых изменений схемы:

```powershell
docker compose run --rm backend alembic check
```

Ожидаемо:

```text
No new upgrade operations detected.
```

## 3. Перезалить demo data

Очистить данные V1:

```powershell
docker compose run --rm backend python scripts/clear_demo_data.py
```

Залить demo data:

```powershell
docker compose run --rm backend python scripts/seed_demo_data.py
```

После seed должны быть:

- 5 вузов
- 5 контактов вузов
- 3 ИТ-направления
- 5 программ
- 3 вендора
- 5 продуктов
- 8 связей `program_products`
- 1 demo manager
- 1 default workflow template `RTK EduFlow Base Workflow` с 14 стадиями и переходами

## 4. Проверить CRUD справочников

В Swagger проверить разделы:

```text
/api/universities
/api/university-contacts
/api/it-directions
/api/it-programs
/api/vendors
/api/it-products
/api/program-products
```

Для справочников доступны:

```text
POST
GET list
GET by id
PATCH
PATCH /{id}/deactivate
```

Для `program-products` доступны:

```text
POST
GET list
GET by id
PATCH
DELETE
```

Примеры фильтров:

```text
GET /api/university-contacts?university_id=<university_id>
GET /api/it-programs?direction_id=<direction_id>
GET /api/it-products?vendor_id=<vendor_id>
GET /api/program-products?program_id=<program_id>
```

## 5. Проверить создание interaction

В Swagger получить ids:

```text
GET /api/universities
GET /api/it-programs
GET /api/it-products
GET /api/workflows/templates?is_default=true
```

ID demo manager взять командой:

```powershell
docker compose exec postgres psql -U rtk_eduflow -d rtk_eduflow -t -A -c "select id from users where email='alexey.andreev@rtk.demo';"
```

Создать interaction:

```text
POST /api/interactions
```

Body:

```json
{
  "university_id": "UUID_вуза",
  "program_id": "UUID_программы",
  "product_id": "UUID_продукта",
  "manager_user_id": "UUID_менеджера",
  "workflow_template_id": "UUID_workflow_template",
  "status": "ACTIVE",
  "comment": "Demo interaction"
}
```

Ожидаемо:

- создается запись `university_interactions`;
- автоматически создаются `workflow_stage_instances`;
- в ответе есть `current_stage_instance_id`.

## 6. Проверить workflow runtime

Проверить созданные этапы:

```text
GET /api/workflows/stage-instances?interaction_id=<interaction_id>
```

Первый этап должен быть:

```text
IN_PROGRESS
```

Проверить текущий этап:

```text
GET /api/workflows/interactions/{interaction_id}/current-stage
```

Найти разрешенный переход из текущего этапа:

```text
GET /api/workflows/transitions?from_stage_id=<workflow_stage_id>
```

Выполнить переход:

```text
POST /api/workflows/interactions/{interaction_id}/transition
```

Body:

```json
{
  "transition_id": "UUID_transition",
  "performed_by": "UUID_менеджера",
  "comment": "Переходим дальше",
  "skip_current": false
}
```

Проверить историю:

```text
GET /api/workflows/transition-history?interaction_id=<interaction_id>
```

Ожидаемо:

- текущий этап становится `COMPLETED`;
- следующий этап становится `IN_PROGRESS`;
- появляется запись в `workflow_transition_history`.

## 7. Проверить статусы stage instance

Можно вручную поменять статус текущего этапа:

```text
PATCH /api/workflows/stage-instances/{stage_instance_id}/status
```

Body:

```json
{
  "status": "WAITING"
}
```

Допустимые статусы:

```text
NOT_STARTED
IN_PROGRESS
WAITING
BLOCKED
COMPLETED
SKIPPED
```

## 8. Проверить важные правила workflow

`requires_comment`:

- в workflow `RTK EduFlow Base Workflow` этап `Обмен документами для подписания` требует комментарий;
- переход с него без `comment` должен вернуть ошибку.

Optional stage:

- этап `Корректировка документов перед подписанием` optional;
- его можно пропустить через:

```json
{
  "transition_id": "UUID_transition",
  "performed_by": "UUID_менеджера",
  "comment": "Пропускаем optional этап",
  "skip_current": true
}
```

`requires_attachment`:

- проверка заложена архитектурно;
- если у этапа выставить `requires_attachment=true`, переход будет требовать запись в `workflow_stage_attachments`.

## 9. Быстрая проверка БД через pgAdmin

Подключение:

```text
Host: localhost
Port: 5432
Database: rtk_eduflow
Username: rtk_eduflow
Password: rtk_eduflow
```

Основные таблицы для проверки:

```text
universities
university_contacts
it_directions
it_programs
vendors
it_products
program_products
users
workflow_templates
workflow_stages
workflow_transitions
university_interactions
workflow_stage_instances
workflow_transition_history
```

# Stage 1 Backend Completion

Дата фиксации: 2026-09-21

## Цель этапа

Этап 1 закрывает backend-основу безопасного CRM-контура: Interaction, роли, data scope, назначения ответственных, история изменений и минимальный audit trail. Frontend-реестр и UI назначения ответственных в этот документ не входят.

## Что реализовано

### 1.1 Каталоги CRM

Backend-роуты каталогов закрыты авторизацией:

- чтение доступно CRM-ролям `KAM`, `MANAGER`, `ADMIN`;
- запись доступна ролям `MANAGER`, `ADMIN`;
- `universities` и `university-contacts` дополнительно фильтруются через visible manager scope для KAM/MANAGER.

Проверяемые каталоги этапа: universities, university-contacts, directions/programs, vendors/products, program-products.

### 1.2 Interaction model

`university_interactions` связаны с:

- university;
- program;
- product;
- responsible KAM через `manager_user_id`;
- workflow template;
- current workflow stage instance.

Несколько interactions одного вуза поддерживаются независимо.

### 1.3 Contracts и licenses

Для этапа 1 договорно-лицензионные поля представлены в `university_interactions`:

- `contract_number`;
- `license_signed`;
- `license_signed_at`;
- `license_valid_until`;
- `transfer_status`;
- `university_responsibles`;
- `comment`.

Эти поля доступны через create/read/update Interaction API. Отдельные normalized tables/API для contract/license/import/report оставлены как заготовка следующего data/import/report контура, чтобы не вводить вторую конкурирующую модель до появления настоящего импорта и отчетов.

### 1.4 Manager hierarchy

Добавлена таблица `manager_memberships` и backend API:

- `GET /api/users/manager-memberships`;
- `POST /api/users/manager-memberships`;
- `PATCH /api/users/manager-memberships/{membership_id}`;
- `PATCH /api/users/manager-memberships/{membership_id}/deactivate`.

Доступ: только `ADMIN`.

Назначение проверяет роли пользователей:

- `manager_user_id` должен иметь роль `MANAGER`;
- `kam_user_id` должен иметь роль `KAM`;
- manager и KAM не могут быть одним пользователем.

### 1.5 Backend data scope

Server-side data scope применяется к:

- interactions;
- universities;
- university-contacts;
- workflow runtime.

Правила:

- `KAM` видит только свои interactions;
- `MANAGER` видит interactions своих KAM из `manager_memberships`;
- `ADMIN` видит все;
- фильтр `manager_user_id` не может расширить scope;
- `data_access_scopes` заложен как ручное ACL-исключение для university/interaction.

Files/reports пока не закрывались scope-логикой, потому что полноценные контуры files/reports относятся к следующим этапам.

### 1.6 Назначение ответственного

Рабочий endpoint:

- `POST /api/interactions/{interaction_id}/assign`.

Правила:

- доступно `MANAGER` и `ADMIN`;
- `MANAGER` может назначать только своих KAM и только interactions внутри своего scope;
- `ADMIN` может назначать/снимать любого ответственного;
- обычный `PATCH /api/interactions/{interaction_id}` не принимает смену `manager_user_id`;
- изменение пишет запись в `responsible_assignment_history`;
- активные workflow stage instances получают нового ответственного.

История назначений доступна через:

- `GET /api/interactions/{interaction_id}/assignment-history`.

Endpoint подчиняется тому же data scope, что и чтение interaction.

### 1.7 AuditEvent

Добавлена таблица `audit_events`:

- `id`;
- `actor_user_id`;
- `action`;
- `entity_type`;
- `entity_id`;
- `result`;
- `reason`;
- `error_code`;
- `metadata` JSONB;
- `request_id`;
- `created_at`.

Admin endpoint:

- `GET /api/audit/events`.

Фильтры:

- `actor_user_id`;
- `action`;
- `entity_type`;
- `entity_id`;
- `date_from`;
- `date_to`;
- `result`.

Записываемые события этапа 1:

- `interaction.create`;
- `interaction.update`;
- `interaction.assign`;
- `interaction.delete`;
- `workflow.transition`;
- `manager_membership.create`;
- `manager_membership.update`;
- `manager_membership.deactivate`.

Заготовки под этап 3 зафиксированы в `AuditService.FILE_AUDIT_ACTIONS`:

- `file.upload`;
- `file.download`;
- `file.delete`;
- `file.scan_status_changed`;
- `storage.presign_generated`.

Audit metadata не должна содержать токены, raw JWT, секреты и лишние персональные данные. Для файлового контура в metadata предполагаются только технические связи: `file_id`, `interaction_id`, `workflow_stage_instance_id`, storage provider/bucket/object key hash или безопасный идентификатор.

### 1.8 Рабочий реестр Interaction

Backend API для реестра готов:

- `GET /api/interactions`;
- фильтры: `university_id`, `program_id`, `product_id`, `manager_user_id`, `status`;
- pagination/sort через общий `PaginationParams`;
- data scope применяется на backend до выдачи результата.

Frontend-реестр, карточка interaction и assignment UI остаются отдельной frontend-задачей.

## Проверки

Команды, которыми проверялся backend после изменений:

```bash
docker compose run --rm backend ruff check app tests scripts
docker compose run --rm backend pytest -q
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend alembic check
docker compose run --rm backend python -m compileall app tests scripts
```

Ожидаемый результат на момент фиксации:

- `ruff` passed;
- `pytest` passed: 23 tests;
- `alembic upgrade head` applied through `c3f8a4d2b7e1`;
- `alembic check` reports no new upgrade operations;
- `compileall` passed.

## Что осознанно остается после этапа 1

- Frontend реестра interactions, карточки и assignment UI.
- Полноценный workflow editor/versioning/branching.
- Файловое хранилище S3/MinIO и audit файловых действий.
- Import XLS/XLSX и normalized contract/license import model.
- Reports и единый report query layer.
- Более широкие интеграционные тесты с отдельной тестовой БД и SQL-level assertions по scope.

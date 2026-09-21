# Database Architecture And Backend API

Дата обновления: 2026-09-21

Документ описывает текущую backend-схему RTK EduFlow CRM после закрытия backend-части этапа 1.

## Структура

1. Таблицы БД: назначение, ключевые связи и примеры заполнения.
2. Backend API: endpoint, доступ, что принимает и что возвращает.

Все изменения схемы выполняются только через Alembic migrations.

## Часть 1. Таблицы БД

Текущие миграции:

- `cade47f9d409_init_crm_schema.py`
- `5b0d2fd1f4d8_add_roles_for_keycloak.py`
- `9c0f4f2a6d1b_add_access_scope_tables.py`
- `b2d7a89e4c31_extend_interactions_for_contracts.py`
- `c3f8a4d2b7e1_add_audit_events.py`

### Служебные Таблицы

| Таблица | Назначение | Пример |
| --- | --- | --- |
| `alembic_version` | Текущая версия миграций Alembic. | `version_num=c3f8a4d2b7e1` |

### Пользователи, Роли И Доступ

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `users` | Локальная CRM-проекция пользователей Keycloak. | `keycloak_user_id` связан с Keycloak `sub`. | `username=kam1`, `role=KAM` |
| `roles` | Справочник CRM-ролей. | Используется через `user_roles`. | `KAM`, `MANAGER`, `ADMIN` |
| `user_roles` | Many-to-many связь пользователей и ролей. | `user_id -> users.id`, `role_id -> roles.id`. | `kam1 -> KAM` |
| `manager_memberships` | Иерархия руководитель -> КАМ для data scope. | `manager_user_id -> users.id`, `kam_user_id -> users.id`. | `manager1 -> kam1`, `is_active=true` |
| `data_access_scopes` | Ручные ACL-исключения доступа к вузу или interaction. | `subject_user_id -> users.id`, optional `university_id`, optional `interaction_id`. | `subject=<user>`, `interaction=<id>`, `access_level=READ` |

Пример логики заполнения:

```text
users:
  kam1     -> KAM
  kam2     -> KAM
  manager1 -> MANAGER
  admin1   -> ADMIN

manager_memberships:
  manager1 -> kam1

Результат:
  kam1 видит свои interactions.
  manager1 видит interactions kam1.
  manager1 не видит interactions kam2.
  admin1 видит все.
```

### CRM-Каталоги

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `universities` | Справочник вузов. | Используется в contacts и interactions. | `name=Demo University`, `region=Tomsk` |
| `university_contacts` | Контакты со стороны вузов. | `university_id -> universities.id`. | `full_name=Ivan Sokolov`, `is_primary=true` |
| `it_directions` | Направления IT-образования. | Используется в programs. | `name=Software Engineering` |
| `it_programs` | Программы обучения. | `direction_id -> it_directions.id`. | `name=Python Backend`, `code=PY-BE` |
| `vendors` | Вендоры продуктов. | Используется в products. | `name=Rostelecom` |
| `it_products` | Продукты/ПО. | `vendor_id -> vendors.id`. | `name=Edu Platform`, `product_type=LMS` |
| `program_products` | Связь программ и продуктов. | `program_id -> it_programs.id`, `product_id -> it_products.id`. | `program=Python Backend`, `product=Edu Platform` |

### Interactions

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `university_interactions` | Основной рабочий объект CRM: вуз, программа, продукт, ответственный и workflow. | `university_id`, `program_id`, `product_id`, `manager_user_id`, `workflow_template_id`, `current_stage_instance_id`. | `contract_number=RTK-DEMO-001`, `manager_user_id=kam1`, `status=ACTIVE` |
| `interaction_contacts` | Контакты, прикрепленные к конкретному interaction. | `interaction_id -> university_interactions.id`, `contact_id -> university_contacts.id`. | `interaction=RTK-DEMO-001`, `role=decision_maker` |
| `responsible_assignment_history` | История смены ответственного КАМ. | `interaction_id -> university_interactions.id`, old/new/changed_by -> `users.id`. | `old_manager=kam1`, `new_manager=kam2`, `reason=handoff` |

Поля договора/лицензии в `university_interactions`:

- `contract_number`;
- `license_signed`;
- `license_signed_at`;
- `license_valid_until`;
- `transfer_status`;
- `university_responsibles`;
- `comment`.

Пример interaction:

```json
{
  "university_id": "11111111-1111-1111-1111-111111111111",
  "program_id": "22222222-2222-2222-2222-222222222222",
  "product_id": "33333333-3333-3333-3333-333333333333",
  "manager_user_id": "44444444-4444-4444-4444-444444444444",
  "workflow_template_id": "55555555-5555-5555-5555-555555555555",
  "status": "ACTIVE",
  "contract_number": "RTK-DEMO-001",
  "license_signed": true,
  "license_signed_at": "2026-09-21T09:00:00Z",
  "license_valid_until": "2027-09-21T09:00:00Z",
  "transfer_status": "TRANSFERRED",
  "university_responsibles": "Ivan Sokolov, Head of Department",
  "comment": "Demo interaction for stage 1 scope checks."
}
```

### Workflow

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `workflow_templates` | Шаблоны workflow. | Используется в interactions и stages. | `name=Default onboarding`, `is_default=true` |
| `workflow_stages` | Этапы внутри шаблона. | `workflow_template_id -> workflow_templates.id`. | `name=License signing`, `order_index=1` |
| `workflow_transitions` | Разрешенные переходы между этапами. | `from_stage_id`, `to_stage_id -> workflow_stages.id`. | `from=License signing`, `to=Materials transfer` |
| `workflow_stage_instances` | Runtime-экземпляры этапов для interaction. | `interaction_id -> university_interactions.id`, `workflow_stage_id -> workflow_stages.id`. | `status=IN_PROGRESS`, `responsible_user_id=kam1` |
| `workflow_transition_history` | История переходов workflow. | `interaction_id`, stage instances, transition, `performed_by -> users.id`. | `performed_by=kam1`, `comment=done` |
| `workflow_stage_comments` | Комментарии к runtime-этапам. | `stage_instance_id -> workflow_stage_instances.id`, `author_user_id -> users.id`. | `comment=Waiting for university confirmation` |
| `workflow_stage_attachments` | Связь этапов workflow с файлами. | `stage_instance_id -> workflow_stage_instances.id`, `file_id -> files.id`. | `stage_instance_id=<id>`, `file_id=<id>` |

Runtime-логика:

```text
При создании interaction backend берет workflow_template_id,
создает workflow_stage_instances для активных stages,
назначает responsible_user_id = interaction.manager_user_id
и ставит начальный stage в IN_PROGRESS.
```

### Файлы

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `files` | Метаданные файлов. Бинарный контент должен быть вынесен в object storage на этапе 3. | `uploaded_by -> users.id`; используется в `workflow_stage_attachments`. | `original_name=contract.pdf`, `mime_type=application/pdf` |

### Audit

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `audit_events` | Журнал критичных backend-действий. | `actor_user_id -> users.id`, `entity_id` хранит id бизнес-сущности. | `action=interaction.assign`, `entity_type=interaction`, `result=SUCCESS` |

Текущие audit actions:

- `interaction.create`;
- `interaction.update`;
- `interaction.assign`;
- `interaction.delete`;
- `workflow.transition`;
- `manager_membership.create`;
- `manager_membership.update`;
- `manager_membership.deactivate`.

Заготовки под этап 3:

- `file.upload`;
- `file.download`;
- `file.delete`;
- `file.scan_status_changed`;
- `storage.presign_generated`.

Пример `audit_events.metadata`:

```json
{
  "old_manager_user_id": "44444444-4444-4444-4444-444444444444",
  "new_manager_user_id": "66666666-6666-6666-6666-666666666666"
}
```

## Часть 2. Backend API

Все endpoints ниже имеют префикс `/api`.

Стандартный ответ ошибки:

```json
{
  "code": "FORBIDDEN",
  "message": "Cannot access this interaction",
  "details": null,
  "requestId": "6f3f843b-4e5c-46df-9df7-0628d88f3d3c"
}
```

### Auth

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/auth/me` | Authenticated | Bearer token | Текущего пользователя |
| `GET` | `/auth/role-check` | `KAM`, `MANAGER`, `ADMIN` | Bearer token | Информацию о доступе |

Пример ответа `/auth/me`:

```json
{
  "id": "user-id",
  "keycloak_user_id": "keycloak-sub",
  "username": "kam1",
  "full_name": "KAM User",
  "email": "kam1@example.local",
  "role": "KAM",
  "roles": ["KAM"]
}
```

### Universities

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/universities` | `KAM`, `MANAGER`, `ADMIN` | `search`, `is_active`, `region`, `city`, pagination/sort | `Page[UniversityRead]` с учетом scope |
| `GET` | `/universities/{university_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `UniversityRead` |
| `POST` | `/universities` | `MANAGER`, `ADMIN` | `UniversityCreate` | `UniversityRead` |
| `PATCH` | `/universities/{university_id}` | `MANAGER`, `ADMIN` | `UniversityUpdate` | `UniversityRead` |
| `PATCH` | `/universities/{university_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `UniversityRead` |

### University Contacts

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/university-contacts` | `KAM`, `MANAGER`, `ADMIN` | `search`, `university_id`, `is_active`, `is_primary`, pagination/sort | `Page[UniversityContactRead]` с учетом scope |
| `GET` | `/university-contacts/{contact_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `UniversityContactRead` |
| `POST` | `/university-contacts` | `MANAGER`, `ADMIN` | `UniversityContactCreate` | `UniversityContactRead` |
| `PATCH` | `/university-contacts/{contact_id}` | `MANAGER`, `ADMIN` | `UniversityContactUpdate` | `UniversityContactRead` |
| `PATCH` | `/university-contacts/{contact_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `UniversityContactRead` |

### Programs And Directions

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/it-directions` | `KAM`, `MANAGER`, `ADMIN` | `search`, `is_active`, pagination/sort | `Page[ITDirectionRead]` |
| `GET` | `/it-directions/{direction_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `ITDirectionRead` |
| `POST` | `/it-directions` | `MANAGER`, `ADMIN` | `ITDirectionCreate` | `ITDirectionRead` |
| `PATCH` | `/it-directions/{direction_id}` | `MANAGER`, `ADMIN` | `ITDirectionUpdate` | `ITDirectionRead` |
| `PATCH` | `/it-directions/{direction_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `ITDirectionRead` |
| `GET` | `/it-programs` | `KAM`, `MANAGER`, `ADMIN` | `search`, `direction_id`, `is_active`, pagination/sort | `Page[ITProgramRead]` |
| `GET` | `/it-programs/{program_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `ITProgramRead` |
| `POST` | `/it-programs` | `MANAGER`, `ADMIN` | `ITProgramCreate` | `ITProgramRead` |
| `PATCH` | `/it-programs/{program_id}` | `MANAGER`, `ADMIN` | `ITProgramUpdate` | `ITProgramRead` |
| `PATCH` | `/it-programs/{program_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `ITProgramRead` |

### Products And Vendors

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/vendors` | `KAM`, `MANAGER`, `ADMIN` | `search`, `is_active`, pagination/sort | `Page[VendorRead]` |
| `GET` | `/vendors/{vendor_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `VendorRead` |
| `POST` | `/vendors` | `MANAGER`, `ADMIN` | `VendorCreate` | `VendorRead` |
| `PATCH` | `/vendors/{vendor_id}` | `MANAGER`, `ADMIN` | `VendorUpdate` | `VendorRead` |
| `PATCH` | `/vendors/{vendor_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `VendorRead` |
| `GET` | `/it-products` | `KAM`, `MANAGER`, `ADMIN` | `search`, `vendor_id`, `is_active`, pagination/sort | `Page[ITProductRead]` |
| `GET` | `/it-products/{product_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `ITProductRead` |
| `POST` | `/it-products` | `MANAGER`, `ADMIN` | `ITProductCreate` | `ITProductRead` |
| `PATCH` | `/it-products/{product_id}` | `MANAGER`, `ADMIN` | `ITProductUpdate` | `ITProductRead` |
| `PATCH` | `/it-products/{product_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `ITProductRead` |
| `GET` | `/program-products` | `KAM`, `MANAGER`, `ADMIN` | `program_id`, `product_id`, `is_required`, pagination/sort | `Page[ProgramProductRead]` |
| `GET` | `/program-products/{link_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `ProgramProductRead` |
| `POST` | `/program-products` | `MANAGER`, `ADMIN` | `ProgramProductCreate` | `ProgramProductRead` |
| `PATCH` | `/program-products/{link_id}` | `MANAGER`, `ADMIN` | `ProgramProductUpdate` | `ProgramProductRead` |
| `DELETE` | `/program-products/{link_id}` | `MANAGER`, `ADMIN` | path id | `204 No Content` |

### Interactions

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/interactions` | `KAM`, `MANAGER`, `ADMIN` | `university_id`, `program_id`, `product_id`, `manager_user_id`, `status`, pagination/sort | `Page[UniversityInteractionRead]` с учетом scope |
| `GET` | `/interactions/{interaction_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `UniversityInteractionRead` |
| `POST` | `/interactions` | `KAM`, `MANAGER`, `ADMIN` | `UniversityInteractionCreate` | `UniversityInteractionRead` |
| `PATCH` | `/interactions/{interaction_id}` | `KAM`, `MANAGER`, `ADMIN` | `UniversityInteractionUpdate`, кроме смены `manager_user_id` | `UniversityInteractionRead` |
| `POST` | `/interactions/{interaction_id}/assign` | `MANAGER`, `ADMIN` | `UniversityInteractionAssign` | `UniversityInteractionRead` |
| `GET` | `/interactions/{interaction_id}/assignment-history` | `KAM`, `MANAGER`, `ADMIN` | path id, pagination | `Page[ResponsibleAssignmentHistoryRead]` |
| `DELETE` | `/interactions/{interaction_id}` | `ADMIN` | path id | `204 No Content` |

Пример создания:

```json
{
  "university_id": "11111111-1111-1111-1111-111111111111",
  "program_id": "22222222-2222-2222-2222-222222222222",
  "product_id": "33333333-3333-3333-3333-333333333333",
  "manager_user_id": "44444444-4444-4444-4444-444444444444",
  "workflow_template_id": "55555555-5555-5555-5555-555555555555",
  "status": "ACTIVE",
  "contract_number": "RTK-DEMO-001",
  "license_signed": true,
  "license_signed_at": "2026-09-21T09:00:00Z",
  "license_valid_until": "2027-09-21T09:00:00Z",
  "transfer_status": "TRANSFERRED",
  "university_responsibles": "Ivan Sokolov, Head of Department",
  "comment": "Created from demo data."
}
```

Пример назначения:

```json
{
  "manager_user_id": "66666666-6666-6666-6666-666666666666",
  "reason": "Reassigned by manager after scope review."
}
```

Снятие ответственного:

```json
{
  "manager_user_id": null,
  "reason": "Temporarily unassigned before redistribution."
}
```

Правила:

- `KAM` работает только со своими interactions.
- `MANAGER` работает только с interactions своих KAM.
- `ADMIN` видит и администрирует все.
- `manager_user_id` нельзя менять через `PATCH /interactions/{id}`.
- Фильтр `manager_user_id` не расширяет data scope.

### Manager Memberships

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/users/manager-memberships` | `ADMIN` | `manager_user_id`, `kam_user_id`, `is_active`, pagination/sort | `Page[ManagerMembershipRead]` |
| `POST` | `/users/manager-memberships` | `ADMIN` | `ManagerMembershipCreate` | `ManagerMembershipRead` |
| `PATCH` | `/users/manager-memberships/{membership_id}` | `ADMIN` | `ManagerMembershipUpdate` | `ManagerMembershipRead` |
| `PATCH` | `/users/manager-memberships/{membership_id}/deactivate` | `ADMIN` | path id | `ManagerMembershipRead` |

Пример создания:

```json
{
  "manager_user_id": "manager-user-id",
  "kam_user_id": "kam-user-id",
  "valid_from": null,
  "valid_to": null
}
```

Правила:

- `manager_user_id` должен иметь роль `MANAGER`;
- `kam_user_id` должен иметь роль `KAM`;
- manager и KAM не могут быть одним пользователем;
- повторный `POST` по существующей паре реактивирует связь.

### Workflow

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/workflows/templates` | `KAM`, `MANAGER`, `ADMIN` | `search`, `is_active`, `is_default`, pagination/sort | `Page[WorkflowTemplateRead]` |
| `GET` | `/workflows/templates/{template_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `WorkflowTemplateRead` |
| `POST` | `/workflows/templates` | `ADMIN` | `WorkflowTemplateCreate` | `WorkflowTemplateRead` |
| `PATCH` | `/workflows/templates/{template_id}` | `ADMIN` | `WorkflowTemplateUpdate` | `WorkflowTemplateRead` |
| `GET` | `/workflows/stages` | `KAM`, `MANAGER`, `ADMIN` | `workflow_template_id`, `is_active`, pagination/sort | `Page[WorkflowStageRead]` |
| `GET` | `/workflows/stages/{stage_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `WorkflowStageRead` |
| `POST` | `/workflows/stages` | `ADMIN` | `WorkflowStageCreate` | `WorkflowStageRead` |
| `PATCH` | `/workflows/stages/{stage_id}` | `ADMIN` | `WorkflowStageUpdate` | `WorkflowStageRead` |
| `GET` | `/workflows/transitions` | `KAM`, `MANAGER`, `ADMIN` | `workflow_template_id`, `from_stage_id`, `to_stage_id`, `is_default`, pagination/sort | `Page[WorkflowTransitionRead]` |
| `GET` | `/workflows/transitions/{transition_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `WorkflowTransitionRead` |
| `POST` | `/workflows/transitions` | `ADMIN` | `WorkflowTransitionCreate` | `WorkflowTransitionRead` |
| `PATCH` | `/workflows/transitions/{transition_id}` | `ADMIN` | `WorkflowTransitionUpdate` | `WorkflowTransitionRead` |
| `GET` | `/workflows/stage-instances` | `KAM`, `MANAGER`, `ADMIN` | `interaction_id`, `status`, pagination/sort | `Page[WorkflowStageInstanceRead]` |
| `GET` | `/workflows/interactions/{interaction_id}/current-stage` | `KAM`, `MANAGER`, `ADMIN` | path id | `WorkflowStageInstanceRead` |
| `PATCH` | `/workflows/stage-instances/{stage_instance_id}/status` | `KAM`, `MANAGER`, `ADMIN` | `WorkflowStageInstanceStatusUpdate` | `WorkflowStageInstanceRead` |
| `GET` | `/workflows/transition-history` | `KAM`, `MANAGER`, `ADMIN` | `interaction_id`, pagination/sort | `Page[WorkflowTransitionHistoryRead]` |
| `POST` | `/workflows/interactions/{interaction_id}/transition` | `KAM`, `MANAGER`, `ADMIN` | `WorkflowTransitionExecute` | `WorkflowTransitionResult` |

Пример workflow transition:

```json
{
  "transition_id": "transition-id",
  "comment": "Stage completed",
  "skip_current": false
}
```

Scope rules:

- runtime endpoints проверяют доступ к interaction;
- non-admin roles должны передавать `interaction_id` при списочных runtime-запросах;
- workflow template/stage/transition editing доступен только `ADMIN`.

### Audit

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/audit/events` | `ADMIN` | `actor_user_id`, `action`, `entity_type`, `entity_id`, `result`, `date_from`, `date_to`, pagination/sort | `Page[AuditEventRead]` |

Примеры:

```text
GET /api/audit/events?action=interaction.assign
GET /api/audit/events?entity_type=interaction&entity_id=<interaction_id>
GET /api/audit/events?result=SUCCESS
```

Пример ответа:

```json
{
  "items": [
    {
      "id": "audit-event-id",
      "actor_user_id": "admin-user-id",
      "action": "interaction.assign",
      "entity_type": "interaction",
      "entity_id": "interaction-id",
      "result": "SUCCESS",
      "reason": "verification unassign",
      "error_code": null,
      "metadata": {
        "old_manager_user_id": "kam1-id",
        "new_manager_user_id": null
      },
      "request_id": "request-id",
      "created_at": "2026-09-21T09:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### Health

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | Public | nothing | `{"status": "ok", "service": "backend"}` |

## Плановые Таблицы Следующих Этапов

Эти таблицы не считаются реализованными, пока нет Alembic migration, модели, API и тестов.

| Этап | Плановые изменения |
| --- | --- |
| 2 | Workflow versioning/governance: versions, change requests, approvals, stage mappings, migration jobs. |
| 3 | Object storage: расширение `files` полями `provider`, `bucket`, `object_key`, `checksum`, `scan_status`. |
| 4 | Imports: `import_jobs`, mappings, row errors, import artifacts. |
| 5 | Reports: `report_jobs`, `report_artifacts`, `report_templates`. |
| 6 | Integrations: sources, inbox/outbox, external links, mappings, delivery attempts. |
| 7 | SLA, risks, notifications. |
| 8 | Participants, cohorts, teachers, schedule после подтверждения данных заказчика. |

## Общие Правила

- PostgreSQL хранит структурированные данные и metadata, не бинарный контент файлов.
- Backend enforce RBAC/data scope; frontend-проверки считаются только UX-слоем.
- Audit metadata не должна содержать токены, raw JWT, секреты и лишние персональные данные.
- Любой новый бизнес-контур должен иметь миграцию, модель, API, Swagger-описание и минимальные тесты.

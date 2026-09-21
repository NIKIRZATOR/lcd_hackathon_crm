# Stage 1 Backend Verification

Дата: 2026-09-21

Документ описывает, как проверить backend-реализацию первого этапа без frontend-сценариев.

## 1. Поднять стенд

```bash
docker compose up -d --build
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python scripts/seed_demo_data.py
```

После seed должны быть доступны demo users:

- `kam1 / kam1`;
- `kam2 / kam2`;
- `manager1 / manager1`;
- `admin1 / admin1`;
- `viewer1 / viewer1`.

Важно: Keycloak импортирует `keycloak/realm/rtk-eduflow-realm.json` при первом старте realm. Если стенд уже был поднят до добавления нового demo user, пересоздайте Keycloak DB/volume или добавьте пользователя вручную в Keycloak Admin Console. На чистом стенде `kam2` уже должен импортироваться из realm-файла.

Ожидаемые demo interactions:

- `RTK-DEMO-001` и `RTK-DEMO-002` назначены на `kam1`;
- `RTK-DEMO-003` назначен на `kam2`;
- `manager1` связан только с `kam1`.

## 2. Backend quality gate

```bash
docker compose run --rm backend ruff check app tests scripts
docker compose run --rm backend pytest -q
docker compose run --rm backend alembic check
docker compose run --rm backend python -m compileall app tests scripts
```

Ожидаемо:

- `ruff` без ошибок;
- все backend tests проходят;
- `alembic check` не находит новых upgrade operations;
- `compileall` проходит без ошибок.

## 3. Swagger/OpenAPI

Открыть:

```text
http://localhost:8000/docs
```

Проверить, что есть и описаны endpoints:

- `GET /api/interactions`;
- `GET /api/interactions/{interaction_id}`;
- `POST /api/interactions`;
- `PATCH /api/interactions/{interaction_id}`;
- `POST /api/interactions/{interaction_id}/assign`;
- `GET /api/interactions/{interaction_id}/assignment-history`;
- `GET /api/users/manager-memberships`;
- `POST /api/users/manager-memberships`;
- `PATCH /api/users/manager-memberships/{membership_id}`;
- `PATCH /api/users/manager-memberships/{membership_id}/deactivate`;
- `GET /api/audit/events`.

Проверить, что схемы содержат описания полей:

- `UniversityInteractionCreate`;
- `UniversityInteractionRead`;
- `UniversityInteractionAssign`;
- `ResponsibleAssignmentHistoryRead`;
- `ManagerMembershipCreate`;
- `ManagerMembershipRead`;
- `AuditEventRead`.

## 4. Авторизация и роли

Проверить `/api/auth/me` под каждым пользователем:

- `kam1` должен иметь роль `KAM`;
- `kam2` должен иметь роль `KAM`;
- `manager1` должен иметь роль `MANAGER`;
- `admin1` должен иметь роль `ADMIN`;
- `viewer1` не должен проходить в бизнес-роуты CRM.

Без token:

```http
GET /api/interactions
```

Ожидаемо: `401 UNAUTHORIZED`.

Под `viewer1`:

```http
GET /api/interactions
```

Ожидаемо: `403 FORBIDDEN`.

## 5. Data Scope: KAM

Под `kam1`:

```http
GET /api/interactions
```

Ожидаемо:

- видны `RTK-DEMO-001`, `RTK-DEMO-002`;
- не виден `RTK-DEMO-003`.

Под `kam1` запросить чужой scope:

```http
GET /api/interactions?manager_user_id=<kam2_user_id>
```

Ожидаемо: `403 FORBIDDEN`.

Под `kam1` открыть interaction `RTK-DEMO-003` по id:

```http
GET /api/interactions/{rtk_demo_003_id}
```

Ожидаемо: `403 FORBIDDEN`.

## 6. Data Scope: MANAGER

Под `manager1`:

```http
GET /api/interactions
```

Ожидаемо:

- видны только interactions подчиненного `kam1`: `RTK-DEMO-001`, `RTK-DEMO-002`;
- `RTK-DEMO-003`, назначенный на `kam2`, не виден.

Попробовать назначить interaction на `kam2`:

```http
POST /api/interactions/{interaction_id}/assign
Content-Type: application/json

{
  "manager_user_id": "<kam2_user_id>",
  "reason": "negative scope test"
}
```

Ожидаемо: `403 FORBIDDEN`.

## 7. Data Scope: ADMIN

Под `admin1`:

```http
GET /api/interactions
```

Ожидаемо:

- видны все demo interactions: `RTK-DEMO-001`, `RTK-DEMO-002`, `RTK-DEMO-003`.

ADMIN может снять ответственного:

```http
POST /api/interactions/{interaction_id}/assign
Content-Type: application/json

{
  "manager_user_id": null,
  "reason": "verification unassign"
}
```

Ожидаемо:

- `200 OK`;
- в ответе `manager_user_id` равен `null`;
- создается запись в assignment history;
- создается audit event `interaction.assign`.

## 8. Запрет старого способа смены ответственного

Под `ADMIN` или `MANAGER` выполнить:

```http
PATCH /api/interactions/{interaction_id}
Content-Type: application/json

{
  "manager_user_id": "<some_user_id>"
}
```

Ожидаемо: `400 BAD_REQUEST`.

Смена ответственного разрешена только через:

```http
POST /api/interactions/{interaction_id}/assign
```

## 9. Assignment History

После успешного назначения выполнить:

```http
GET /api/interactions/{interaction_id}/assignment-history
```

Ожидаемо:

- есть запись с `interaction_id`;
- заполнены `old_manager_user_id`;
- заполнены `new_manager_user_id` или `null` при снятии;
- заполнен `changed_by_user_id`;
- сохранен `reason`;
- заполнен `changed_at`.

Под пользователем вне data scope endpoint должен вернуть `403`.

## 10. Manager Memberships API

Под `ADMIN`:

```http
GET /api/users/manager-memberships
```

Ожидаемо:

- есть связь `manager1 -> kam1`;
- связи `manager1 -> kam2` нет, если ее не создавали вручную.

Создать или реактивировать связь:

```http
POST /api/users/manager-memberships
Content-Type: application/json

{
  "manager_user_id": "<manager1_user_id>",
  "kam_user_id": "<kam2_user_id>"
}
```

Ожидаемо:

- `201 Created`;
- связь активна;
- создается audit event `manager_membership.create`.

Деактивировать связь:

```http
PATCH /api/users/manager-memberships/{membership_id}/deactivate
```

Ожидаемо:

- `200 OK`;
- `is_active=false`;
- создается audit event `manager_membership.deactivate`;
- после деактивации связь не должна расширять MANAGER scope.

Под не-ADMIN:

```http
GET /api/users/manager-memberships
```

Ожидаемо: `403 FORBIDDEN`.

## 11. Audit Events

Под `ADMIN`:

```http
GET /api/audit/events
```

Ожидаемо:

- endpoint доступен;
- можно фильтровать по `action`, `entity_type`, `entity_id`, `actor_user_id`, `result`, `date_from`, `date_to`;
- после назначения ответственного есть событие `interaction.assign`;
- после workflow transition есть событие `workflow.transition`;
- после изменения manager membership есть событие `manager_membership.*`.

Примеры:

```http
GET /api/audit/events?action=interaction.assign
GET /api/audit/events?entity_type=interaction&entity_id=<interaction_id>
GET /api/audit/events?result=SUCCESS
```

Под не-ADMIN:

```http
GET /api/audit/events
```

Ожидаемо: `403 FORBIDDEN`.

## 12. Interaction Fields From ТЗ

Создать или обновить interaction с полями:

```http
PATCH /api/interactions/{interaction_id}
Content-Type: application/json

{
  "contract_number": "RTK-CHECK-001",
  "license_signed": true,
  "license_signed_at": "2026-09-21T09:00:00Z",
  "license_valid_until": "2027-09-21T09:00:00Z",
  "transfer_status": "TRANSFERRED",
  "university_responsibles": "Ivan Sokolov, Head of Department",
  "comment": "Stage 1 verification"
}
```

Ожидаемо:

- `200 OK`;
- поля возвращаются в `GET /api/interactions/{interaction_id}`;
- создается audit event `interaction.update`.

## 13. Workflow Runtime Scope And Audit

Под пользователем, у которого есть доступ к interaction:

```http
GET /api/workflows/interactions/{interaction_id}/current-stage
GET /api/workflows/stage-instances?interaction_id={interaction_id}
GET /api/workflows/transition-history?interaction_id={interaction_id}
```

Ожидаемо: данные доступны.

Под пользователем вне scope:

```http
GET /api/workflows/interactions/{foreign_interaction_id}/current-stage
```

Ожидаемо: `403 FORBIDDEN`.

После успешного workflow transition проверить:

```http
GET /api/audit/events?action=workflow.transition
```

Ожидаемо: есть audit event с `entity_type=interaction` и `entity_id=<interaction_id>`.

## 14. Критерий закрытия backend этапа 1

Backend этап 1 можно считать закрытым, если:

- quality gate проходит;
- Swagger содержит новые endpoints и описания схем;
- KAM/MANAGER/ADMIN scope работает прямыми API-запросами;
- assignment работает только через `/assign`;
- assignment history заполняется и читается с учетом scope;
- manager memberships управляются через ADMIN API;
- audit events создаются для ключевых действий;
- новые поля Interaction доступны через API;
- known gaps из `stage1_backend_completion.md` остаются только для следующих этапов или frontend.

# Stage 2 Workflow Backend Progress

Дата фиксации: 2026-09-21

## Краткий статус

Работа остановлена после шагов A-C из промта:

1. Audit.
2. Seed официального workflow.
3. Базовое workflow versioning / draft / publish / runtime binding.

Frontend не изменялся.

## Что сделано

### Step A - Audit

- Изучена текущая workflow-реализация backend:
  - SQLAlchemy models;
  - schemas;
  - repositories;
  - services;
  - routers;
  - migration;
  - seed;
  - связь с `university_interactions`;
  - data scope через существующие access helpers;
  - audit через существующий `AuditService`.
- Создан документ аудита:
  - `docs/stage2_workflow_audit.md`
- Зафиксировано, что текущий workflow до Stage 2 был template-centric:
  - stages/transitions принадлежали напрямую template;
  - interactions хранили `workflow_template_id`;
  - отдельной immutable version-сущности не было.

### Step B - Seed

- Demo workflow заменён на официальный базовый workflow:
  - `RTK EduFlow Base Workflow`
  - 14 стадий по ТЗ.
- Seed вынесен в отдельный модуль данных:
  - `backend/scripts/workflow_seed_data.py`
- Seed стал безопаснее при повторном запуске:
  - переиспользует legacy template `Basic University Interaction`, если он уже есть;
  - обновляет template fields;
  - делает официальный workflow единственным default;
  - не создаёт дубли stages/transitions;
  - деактивирует legacy stages внутри той же version.
- Добавлен unit-тест формы seed-данных:
  - `backend/tests/unit/test_workflow_seed.py`
- Обновлена проверочная документация:
  - `backend/docs/README_CHECK_FLOW.md`

### Step C - Versioning / Draft / Publish / Runtime Binding

- Добавлена модель:
  - `WorkflowVersion`
- Добавлена таблица:
  - `workflow_versions`
- Добавлены поля:
  - `workflow_stages.workflow_version_id`
  - `workflow_transitions.workflow_version_id`
  - `university_interactions.workflow_version_id`
- Добавлена migration:
  - `backend/migrations/versions/d7c1b2a9e8f0_add_workflow_versions.py`
- Migration делает backfill:
  - для каждого existing template создаёт published version `1`;
  - привязывает existing stages/transitions к этой version;
  - привязывает existing interactions к version своего template.
- Добавлены статусы version:
  - `DRAFT`
  - `PUBLISHED`
  - `ARCHIVED`
- Добавлены API endpoints:
  - `GET /api/workflows/templates/{template_id}/versions`
  - `POST /api/workflows/templates/{template_id}/versions/draft`
  - `POST /api/workflows/versions/{version_id}/publish`
- Реализовано создание draft:
  - запрещает второй draft для template;
  - клонирует stages/transitions из текущей published version.
- Реализована публикация draft:
  - draft становится `PUBLISHED`;
  - предыдущая published version архивируется.
- Published workflow защищён от прямого изменения через stage/transition create/update:
  - изменения разрешаются только для draft version.
- Runtime теперь version-aware:
  - новые interactions получают current published version;
  - stage instances создаются из stages конкретной version;
  - transition execution проверяет transition внутри interaction version.

## Проверки, которые прошли

```bash
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend alembic check
docker compose run --rm backend pytest tests/unit -q
docker compose run --rm backend ruff check ...
python -m compileall app scripts tests migrations
docker compose run --rm backend python scripts/seed_demo_data.py
```

Результаты:

- `alembic upgrade head` - passed.
- `alembic check` - passed.
- `pytest tests/unit -q` - 25 passed.
- `ruff check` - passed.
- `compileall` - passed.
- `seed_demo_data.py` - passed.

Дополнительная SQL-проверка после seed:

```text
RTK EduFlow Base Workflow | 1 | PUBLISHED | 14 active stages
```

## Изменённые файлы на текущем срезе

### Backend models / schemas / services

- `backend/app/models.py`
- `backend/app/modules/interactions/model.py`
- `backend/app/modules/interactions/schemas.py`
- `backend/app/modules/interactions/service.py`
- `backend/app/modules/workflows/model.py`
- `backend/app/modules/workflows/repository.py`
- `backend/app/modules/workflows/router.py`
- `backend/app/modules/workflows/schemas.py`
- `backend/app/modules/workflows/service.py`

### Migration

- `backend/migrations/versions/d7c1b2a9e8f0_add_workflow_versions.py`

### Seed / tests / docs

- `backend/scripts/seed_demo_data.py`
- `backend/scripts/workflow_seed_data.py`
- `backend/tests/unit/test_workflow_seed.py`
- `backend/docs/README_CHECK_FLOW.md`
- `docs/stage2_workflow_audit.md`
- `docs/stage_2_be/stage2_workflow_progress.md`

## Что ещё впереди по промту

### Step D - Graph

- Частично сделано:
  - добавлена выборка transitions для текущей stage с привязкой к workflow version;
  - добавлен endpoint `GET /api/workflows/interactions/{interaction_id}/available-transitions`;
  - endpoint использует существующий RBAC/data scope через `_ensure_can_access_interaction`;
  - available transitions возвращают classification `FORWARD`, `BACKWARD`, `OPTIONAL`, `BRANCH`;
  - публикация draft валидирует graph до изменения статусов versions.
- Graph validation проверяет:
  - stages и transitions одной version;
  - ровно одну initial stage;
  - минимум одну final stage;
  - запрет self-loop;
  - запрет duplicate transition;
  - не более одного default transition из одной stage;
  - outgoing transition для каждой non-final stage;
  - incoming transition для каждой non-initial stage.
- Добавлены unit-тесты:
  - graph принимает forward/backward/optional/branch transitions;
  - graph отклоняет несколько initial stages;
  - graph отклоняет transition к stage другой version;
  - available transition classification для forward/backward/optional/branch.
- Ещё нужно:
  - перевести illegal transition runtime-error на стабильную conflict semantics в Step E;
  - добавить integration/API tests для endpoint available transitions;
  - при необходимости расширить official seed нелинейными transitions.

### Step E - TransitionService

- Частично сделано:
  - выделен domain-level `TransitionService`;
  - `WorkflowRuntimeService.execute_transition` оставлен как compatibility wrapper;
  - workflow transition audit перенесён из router в domain service;
  - current stage update, target stage update, transition history и audit создаются до одного `commit`;
  - router передаёт `request_id`, но не делает отдельный audit commit;
  - добавлено опциональное поле `expected_current_stage_instance_id` для stale/current stage guard;
  - interaction, current stage instance и target stage instance блокируются на время перехода через row-level `FOR UPDATE`;
  - illegal transition, inactive current stage и invalid skip возвращают `409 CONFLICT`;
  - transition domain errors возвращают стабильные коды/details через единый error envelope;
  - `performed_by` в request-схеме стал optional для API, router принудительно подставляет authenticated user.
- Добавлены unit-тесты:
  - successful transition creates history and audit atomically;
  - illegal transition returns conflict;
  - audit failure triggers rollback without commit.
  - transition endpoint подставляет authenticated user и пишет audit;
  - transition endpoint возвращает стабильный domain error envelope.
- Ещё нужно:
  - при необходимости добавить полноформатные DB integration race-тесты для row-level locking.

### Step F - Governance

- Частично сделано:
  - добавлен endpoint `GET /api/workflows/versions/{version_id}/dangerous-changes`;
  - detector сравнивает draft version с `supersedes_version_id`;
  - фиксируются removed stages, added stages, stage contract changes, order changes, removed transitions, added transitions;
  - change severity: `LOW`, `MEDIUM`, `HIGH`;
  - response включает `active_interaction_count` для superseded version;
  - `workflow.version.draft_created` пишется в audit при создании draft;
  - `workflow.version.published` пишется в audit при publish с summary dangerous changes;
  - audit draft/publish выполняется в той же транзакции, что и lifecycle action;
  - добавлена approval/change-request модель:
    - `workflow_change_requests`;
    - statuses `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`;
    - dangerous changes snapshot;
    - approve/reject API;
    - publish требует approved change request при `MEDIUM/HIGH` dangerous changes;
  - change request audit:
    - `workflow.change_request.created`;
    - `workflow.change_request.approved`;
    - `workflow.change_request.rejected`.
- Добавлены unit-тесты:
  - detector находит removed stage, removed transition и contract change;
  - added-only изменения считаются low-severity.

### Step G - Migration

- Частично сделано:
  - добавлены таблицы:
    - `workflow_stage_mappings`;
    - `workflow_migration_jobs`.
  - добавлен migration preview:
    - `POST /api/workflows/versions/{version_id}/migration/preview`;
    - auto mapping stages по одинаковому имени;
    - explicit mappings из request;
    - missing mapping detection для current active stages.
  - добавлен migration execution:
    - `POST /api/workflows/versions/{version_id}/migration/execute`;
    - переносит active interactions с superseded version на target version;
    - создаёт target stage instances;
    - обновляет `workflow_version_id` и `current_stage_instance_id`;
    - сохраняет старую transition history без удаления;
    - пишет `workflow.migration.executed` в audit.
  - добавлены migration jobs со статусами `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`.
- Добавлены unit-тесты:
  - missing mapping detection для migration preview helper.
- Ещё нужно:
  - добавить более широкие integration tests на migration execution на реальной БД;
  - при необходимости хранить подробный per-interaction migration report.

### Step H - Tests / Docs

- Расширить unit/integration tests по списку из промта.
- Обновить Swagger-facing schemas/descriptions при необходимости.
- Создать финальный документ:
  - `docs/stage2_workflow_backend.md`
- Прогнать полный набор проверок:
  - `ruff`;
  - `pytest`;
  - `alembic upgrade head`;
  - `alembic check`;
  - `compileall`.

## Известные ограничения текущего среза

- Graph пока остаётся в основном линейным в seed.
- Backward/branch transitions ещё не добавлены в официальный workflow.
- Available transitions endpoint добавлен, но пока покрыт только unit-тестом classification.
- TransitionService выделен; DB-level row locking добавлен, но race-тесты на реальной БД ещё можно расширить.
- Audit publish/draft lifecycle расширен событиями `workflow.version.draft_created` и `workflow.version.published`.
- Migration active instances между versions реализована базово через stage mappings и migration jobs.
- Frontend не изменялся и пока не адаптирован под versioning.

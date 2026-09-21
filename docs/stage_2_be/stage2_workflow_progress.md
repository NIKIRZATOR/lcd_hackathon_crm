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

- Расширить transitions как полноценный graph:
  - forward;
  - backward;
  - optional routes;
  - branch transitions.
- Добавить graph validation:
  - stages одной version;
  - initial/final invariants;
  - отсутствие некорректных переходов между версиями;
  - available transitions для current stage.
- Добавить тесты:
  - forward transition;
  - backward transition;
  - optional transition;
  - branch transition;
  - illegal transition returns conflict.

### Step E - TransitionService

- Выделить единый domain-level `TransitionService`.
- Уточнить error semantics:
  - illegal transition;
  - missing comment;
  - missing attachment readiness;
  - stale/current stage conflict.
- Усилить atomicity:
  - current stage update;
  - target stage update;
  - history;
  - audit.
- Добавить concurrency guard.
- Добавить тесты history/audit/atomic rollback.

### Step F - Governance

- Dangerous change detection для draft/published/runtime workflow.
- Change request / approval model, если потребуется в рамках Stage 2.
- Audit events для publish/governance actions.

### Step G - Migration

- Stage mappings между versions.
- Migration preview.
- Migration jobs.
- Controlled migration active interactions на новую version.
- Сохранение старой history.

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
- Available transitions endpoint ещё не выделен отдельно.
- TransitionService пока остаётся частью `WorkflowRuntimeService`.
- Audit publish/draft lifecycle пока не расширен отдельными событиями.
- Migration active instances между versions пока не реализована.
- Frontend не изменялся и пока не адаптирован под versioning.

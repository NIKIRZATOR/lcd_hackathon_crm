# Stage 2 Workflow Backend Completion

Дата закрытия: 2026-09-22

## Статус

Stage 2 backend Workflow Engine закрыт.

Frontend в рамках Stage 2 не изменялся.

## Краткий итог

Существующий workflow backend расширен до versioned workflow engine:

- workflow templates получили immutable versions;
- draft/publish lifecycle реализован на backend;
- active interactions привязываются к конкретной published version;
- transitions работают как graph;
- runtime transition выполняется атомарно через `TransitionService`;
- history, audit и data scope встроены в workflow runtime;
- dangerous changes выявляются до publish;
- dangerous publish требует approved change request;
- active interactions можно controlled-migrate на новую workflow version через stage mappings.

## Реализованные шаги

### Step A - Audit

- Проведен аудит текущего workflow backend.
- Создан документ:
  - `docs/stage2_workflow_audit.md`

### Step B - Seed

- Добавлен официальный базовый workflow:
  - `RTK EduFlow Base Workflow`
- Seed содержит 14 стадий по ТЗ.
- Seed сделан deterministic/idempotent.

### Step C - Versioning

- Добавлена таблица:
  - `workflow_versions`
- Stages/transitions/interactions привязаны к workflow version.
- Добавлены статусы:
  - `DRAFT`
  - `PUBLISHED`
  - `ARCHIVED`
- Published workflow защищен от прямого изменения.

### Step D - Graph

- Transitions используются как graph.
- Поддержаны:
  - forward;
  - backward;
  - optional;
  - branch.
- Добавлен endpoint available transitions:
  - `GET /api/workflows/interactions/{interaction_id}/available-transitions`
- Publish валидирует graph-инварианты.

### Step E - TransitionService

- Выделен domain-level `TransitionService`.
- Transition атомарно:
  - обновляет current stage;
  - активирует target stage;
  - создает transition history;
  - создает audit event.
- Добавлен row-level locking через `FOR UPDATE`.
- Добавлены stable domain error codes/details.

### Step F - Governance

- Добавлен dangerous changes preview:
  - `GET /api/workflows/versions/{version_id}/dangerous-changes`
- Добавлена approval/change-request модель:
  - `workflow_change_requests`
- Publish с `MEDIUM/HIGH` changes требует approved change request.
- Добавлен audit lifecycle для draft/publish/change-request.

### Step G - Migration

- Добавлены таблицы:
  - `workflow_stage_mappings`
  - `workflow_migration_jobs`
- Добавлен migration preview:
  - `POST /api/workflows/versions/{version_id}/migration/preview`
- Добавлен migration execution:
  - `POST /api/workflows/versions/{version_id}/migration/execute`
- Active interactions переносятся на target version с сохранением старой history.

## Новые и измененные таблицы

### Новые

- `workflow_versions`
- `workflow_change_requests`
- `workflow_stage_mappings`
- `workflow_migration_jobs`

### Измененные

- `workflow_stages`
  - `workflow_version_id`
- `workflow_transitions`
  - `workflow_version_id`
- `university_interactions`
  - `workflow_version_id`

## Alembic revisions

- `d7c1b2a9e8f0_add_workflow_versions.py`
- `e8f2a4c6d9b1_add_workflow_governance_migration.py`

## Основные API endpoints

- `GET /api/workflows/templates/{template_id}/versions`
- `POST /api/workflows/templates/{template_id}/versions/draft`
- `POST /api/workflows/versions/{version_id}/publish`
- `GET /api/workflows/versions/{version_id}/dangerous-changes`
- `POST /api/workflows/versions/{version_id}/change-request`
- `GET /api/workflows/change-requests`
- `GET /api/workflows/change-requests/{change_request_id}`
- `POST /api/workflows/change-requests/{change_request_id}/approve`
- `POST /api/workflows/change-requests/{change_request_id}/reject`
- `GET /api/workflows/interactions/{interaction_id}/available-transitions`
- `POST /api/workflows/interactions/{interaction_id}/transition`
- `POST /api/workflows/versions/{version_id}/migration/preview`
- `POST /api/workflows/versions/{version_id}/migration/execute`

## Audit events

- `workflow.version.draft_created`
- `workflow.version.published`
- `workflow.change_request.created`
- `workflow.change_request.approved`
- `workflow.change_request.rejected`
- `workflow.transition`
- `workflow.migration.executed`

## Права и data scope

- KAM видит и меняет только свои interactions.
- MANAGER работает в рамках subordinate KAM scope.
- ADMIN управляет workflow lifecycle, governance и migration.
- Workflow runtime endpoints используют существующие RBAC/data scope helpers.

## Ограничения, перенесенные дальше

- Frontend workflow editor не реализовывался.
- Risk Center, SLA engine, notifications, reports, file storage не реализовывались.
- Полноформатные DB race-tests для row locking можно расширить отдельно.
- Подробный per-interaction migration report можно добавить на следующем этапе.
- Official seed остается в основном линейным; backend уже поддерживает graph transitions.

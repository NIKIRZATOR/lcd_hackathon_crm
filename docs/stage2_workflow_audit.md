# Stage 2 Workflow Audit

## Scope

This audit covers the existing backend workflow implementation before Stage 2 changes. No models, migrations, API routes, frontend files, or runtime behavior were changed during this step.

## Current Architecture Summary

The current workflow backend is a template-based runtime without separate workflow versions. `workflow_templates` own `workflow_stages` and `workflow_transitions` directly. `university_interactions` store `workflow_template_id` and `current_stage_instance_id`; they do not store a concrete immutable workflow version.

When an interaction is created, `UniversityInteractionService.create_interaction()` validates that the selected template has active stages, creates the interaction, and calls `WorkflowRuntimeService.initialize_interaction_workflow()`. Runtime stage instances are created for every active stage in template order. The initial stage is the stage marked `is_initial`, or the first active stage if no initial flag exists. The interaction current stage points to that initial stage instance.

Transitions are real runtime data, not only a schema stub. `WorkflowRuntimeService.execute_transition()` requires a `workflow_transition_id`, verifies that the transition belongs to the interaction template and starts from the current stage, updates stage instance statuses, updates `current_stage_instance_id`, and writes `workflow_transition_history`. The API route also writes `audit_events` with action `workflow.transition`.

Data scope is applied at router level through existing interaction access helpers. Runtime endpoints first check that the user can read the interaction via `ensure_can_read_interaction()`. This reuses the existing KAM/MANAGER/ADMIN and explicit scope rules.

## Audit Table

| Component / entity / endpoint | Current behavior | Status | Keep / Modify / Replace | Required Stage 2 action |
| --- | --- | --- | --- | --- |
| `WorkflowTemplate` / `workflow_templates` | Logical workflow template with `name`, `description`, string `version`, `is_active`, `is_default`, `created_by`. Owns stages/transitions directly by FK from child tables. | PARTIAL | Modify | Keep as logical workflow root. Move version semantics out of string field into explicit version model or equivalent normalized structure. |
| `WorkflowStage` / `workflow_stages` | Stage belongs directly to `workflow_template_id`; fields include order, initial/final/optional flags, duration, required comment/attachment, active flag. | PARTIAL | Modify | Bind stages to a concrete workflow version. Preserve existing stage metadata and add constraints needed for versioned immutable published workflows. |
| `WorkflowTransition` / `workflow_transitions` | Transition belongs directly to `workflow_template_id`; stores `from_stage_id`, `to_stage_id`, optional name/default/condition code. Used by runtime transition execution. | PARTIAL | Modify | Bind transitions to workflow version and extend metadata for graph route type if needed. Preserve existing from/to graph model. |
| `WorkflowStageInstance` / `workflow_stage_instances` | Runtime stage instance per interaction and workflow stage. Stores status, responsible user, started/due/completed/skipped timestamps. | WORKING | Modify | Preserve runtime concept. Add or derive workflow version binding so active interactions stay on their original published version. |
| `WorkflowTransitionHistory` / `workflow_transition_history` | History row created on successful transition with interaction, from/to stage instances, transition, performer, comment, performed timestamp. | WORKING | Modify | Keep. Consider storing version/transition snapshot data if later migrations can change referenced definitions. |
| `WorkflowStageComment` / `workflow_stage_comments` | Comment entity for a stage instance. Not part of transition history. | WORKING | Keep | Keep for Stage 2. Use transition comment validation already present for `requires_comment`. |
| `WorkflowStageAttachment` / `workflow_stage_attachments` | Attachment link to `files`; runtime checks count when current stage requires attachment. No storage implementation here. | PARTIAL | Keep | Keep the flag and count-based readiness, but do not implement file storage in Stage 2. |
| `UniversityInteraction.workflow_template_id` | Interaction stores template FK selected at creation. It blocks changing template after workflow initialization. | PARTIAL | Modify | Keep compatibility field if useful, but add runtime binding to a published workflow version. New interactions should use current published version. |
| `UniversityInteraction.current_stage_instance_id` | Points to the active stage instance. Used by current stage and transition execution. | WORKING | Keep | Keep. Ensure current instance belongs to the interaction's bound version. |
| Workflow initialization | Creates stage instances for all active template stages, picks initial stage, marks it `IN_PROGRESS`, others `NOT_STARTED`, assigns responsible KAM, sets due date for initial stage. | WORKING | Modify | Repoint initialization from template stages to published version stages. Existing behavior can remain structurally similar. |
| Current stage resolution | Loads interaction by ID, uses `current_stage_instance_id`, returns corresponding `WorkflowStageInstance`. | WORKING | Keep | Keep. Add version consistency checks if version binding is introduced on instances/interactions. |
| Transition execution | Requires active current stage, allowed transition from current stage, valid performer, required comment/attachment. Updates current as completed/skipped, target as in progress, creates history, commits atomically. | PARTIAL | Modify | Evolve into a single explicit TransitionService with conflict/domain errors, concurrency guard, version checks, and stricter transaction boundary including audit if possible. |
| Backward transitions | Possible only if a `workflow_transitions` row points from the current stage to a previous stage. No dedicated type or policy. | PARTIAL | Modify | Add explicit support and tests for backward transitions as graph edges. |
| Arbitrary transitions | Possible only through configured `workflow_transitions` from the current stage. Direct arbitrary target stage is not supported. | WORKING | Keep | Preserve "only configured edges" invariant. Add clearer conflict error for illegal transitions. |
| Optional routes | Stage has `is_optional`; `skip_current` is allowed only when current stage is optional. Seed contains one optional linear stage. | PARTIAL | Modify | Preserve flag but model optional route behavior through graph transitions and tests. |
| Branching | Data model can represent multiple outgoing transitions, but seed and tests currently only cover a linear chain. | PARTIAL | Modify | Add branch scenarios, validation, and available transitions endpoint/behavior. |
| Required comment validation | `requires_comment` on current stage blocks transition unless transition payload comment is non-empty. | WORKING | Keep | Keep and test in Stage 2 transition service. |
| Required attachment validation | `requires_attachment` on current stage blocks transition if there are no attachment rows for the current stage instance. | PARTIAL | Keep | Keep architecture-ready check. Do not add storage implementation in Stage 2. |
| Transition history creation | Created inside the same try/commit block as status/current-stage updates. | WORKING | Keep | Keep atomicity, extend tests for rollback behavior. |
| Audit event creation | Router logs `workflow.transition` after service transition succeeds, using existing `AuditService`. | WORKING | Modify | Keep existing audit mechanism. Consider wrapping audit with transition in one service-level transaction or document transactional boundary. Add audit for publish/migration/governance actions. |
| Data scope for runtime endpoints | `current-stage`, `stage-instances`, `transition-history`, and transition execution check interaction access with existing auth helpers. | WORKING | Keep | Reuse this mechanism for all new workflow runtime endpoints. Avoid parallel access control. |
| Template/stage/transition CRUD permissions | Create/update for templates, stages, transitions require ADMIN. Reads require CRM roles. | WORKING | Modify | Keep role model. Add lifecycle-specific admin endpoints for draft/publish/version governance. |
| `GET /api/workflows/templates` | Lists templates with filters/search/pagination. | WORKING | Modify | Keep for compatibility. Add version-aware template response or new version endpoints. |
| `GET /api/workflows/templates/{template_id}` | Reads one template. | WORKING | Modify | Keep for compatibility. Add current published/draft version details as needed. |
| `POST /api/workflows/templates` | ADMIN creates mutable template directly. | PARTIAL | Modify | Keep or adapt as logical template creation. Stage 2 should create a draft version rather than editable published structure. |
| `PATCH /api/workflows/templates/{template_id}` | ADMIN mutates template directly. | PARTIAL | Modify | Prevent dangerous direct mutation of published workflow data. Restrict mutable fields or draft-only changes. |
| `GET /api/workflows/stages` | Lists stages by direct template FK and active flag. | WORKING | Modify | Add version filter or migrate to version-scoped stages. Maintain compatibility if feasible. |
| `POST/PATCH /api/workflows/stages` | ADMIN directly creates/updates stages under template. | PARTIAL | Modify | Restrict to draft versions. Add dangerous change detection for active published/runtime stages. |
| `GET /api/workflows/transitions` | Lists graph edges by template/from/to/default filters. | WORKING | Modify | Add version filter and expose available transitions for current runtime stage. |
| `POST/PATCH /api/workflows/transitions` | ADMIN directly creates/updates transitions under template. | PARTIAL | Modify | Restrict to draft versions and add graph validation. |
| `GET /api/workflows/stage-instances` | Lists runtime instances. Non-admin users must provide `interaction_id`; access is checked. | WORKING | Keep | Keep behavior. Add version fields only if schema changes require it. |
| `GET /api/workflows/interactions/{interaction_id}/current-stage` | Returns current stage instance after interaction scope check. | WORKING | Keep | Keep. Extend response if frontend/API needs stage/version metadata later. |
| `PATCH /api/workflows/stage-instances/{stage_instance_id}/status` | Allows CRM roles to mutate status after access check. | PARTIAL | Modify | Reassess for Stage 2 invariants; direct status mutation may bypass transition history/audit. |
| `GET /api/workflows/transition-history` | Lists history. Non-admin users must provide accessible `interaction_id`. | WORKING | Keep | Keep and possibly extend with version/route metadata. |
| `POST /api/workflows/interactions/{interaction_id}/transition` | Executes configured transition from current stage and logs audit. Performer is forced to current user. | PARTIAL | Modify | Move to explicit Stage 2 TransitionService semantics, conflict errors, available transition validation, audit/history atomicity. |
| Seed workflow | Demo workflow "Basic University Interaction" with six stages and linear transitions. Idempotent by template name, stage name, and from/to transition pair. | PARTIAL | Modify | Replace or extend with official 14-stage RTK workflow via existing seed pattern. Ensure idempotency across versions/stages/transitions. |
| Alembic migration `cade47f9d409_init_crm_schema.py` | Creates current workflow tables, interaction FKs, and history/comments/attachments. No version/governance/migration tables. | PARTIAL | Modify | Add new migration(s) for workflow versions, version FKs, runtime binding, governance/migration structures and indexes. |
| Tests | Only general unit tests exist; no workflow service/router integration tests are present. Stage 1 docs describe manual verification. | MISSING | Modify | Add focused workflow tests for versioning, transitions, scope, audit, dangerous changes, and migration. |
| Documentation | `docs/db_architecture.md`, `backend/docs/README_CHECK_FLOW.md`, and Stage 1 docs describe current workflow behavior. | PARTIAL | Modify | Keep current docs as historical/reference. Add Stage 2 backend docs after implementation. |

## Answers To Required Questions

- Existing models: `WorkflowTemplate`, `WorkflowStage`, `WorkflowTransition`, `WorkflowStageInstance`, `WorkflowTransitionHistory`, `WorkflowStageComment`, `WorkflowStageAttachment`, plus `UniversityInteraction` workflow fields.
- Existing fields: listed in the table above; current schema is template-centric and has no `workflow_versions` table.
- Workflow creation: ADMIN can create templates/stages/transitions through `/api/workflows/*`; demo seed also creates a default template, stages, and linear transitions.
- Workflow instance creation: `WorkflowRuntimeService.initialize_interaction_workflow()` creates stage instances during interaction creation.
- How interaction gets workflow: `UniversityInteractionCreate.workflow_template_id` is validated and stored, then runtime instances are initialized from active stages of that template.
- Current stage: `university_interactions.current_stage_instance_id`.
- Transition execution: `WorkflowRuntimeService.execute_transition()` validates configured transition from current stage and updates state/history.
- Transition history: inserted as `WorkflowTransitionHistory` inside the transition transaction.
- Backward transitions: structurally possible as configured graph edges, but not explicitly modeled, seeded, or tested.
- Arbitrary transitions: not supported directly; only configured transitions from current stage are allowed.
- `workflow_transitions` usage: real runtime usage exists through `get_allowed_transition()`.
- Data scope: applied in router through existing interaction access helpers.
- Existing endpoints: template/stage/transition CRUD reads/writes, runtime stage instances, current stage, status update, transition history, execute transition.
- Existing tests: no workflow-specific automated tests were found; only access policy tests include `workflow_template_id` as interaction data.
- Parts to preserve: runtime stage instances, graph transition table, history table, required comment/attachment checks, current stage pointer, existing data scope helpers, audit service integration.

## Migration Strategy

1. Add versioning without replacing the whole workflow subsystem.
2. Introduce `workflow_versions` linked to `workflow_templates`, with unique `(workflow_template_id, version)` and statuses `DRAFT`, `PUBLISHED`, `ARCHIVED`.
3. Add version FKs to stages and transitions. Backfill existing stages/transitions into version 1 for each template, marking the default/current data as `PUBLISHED`.
4. Add runtime binding from active interactions to the published version they were initialized from. Prefer an explicit `workflow_version_id` on `university_interactions`; optionally mirror it on `workflow_stage_instances` if it simplifies validation and migration.
5. Keep `workflow_template_id` for compatibility during migration and for logical grouping.
6. Update creation of interactions to select the current published version for the chosen/default template.
7. Restrict direct mutation of published stages/transitions; all structural edits should happen on drafts.
8. Preserve existing transition/history behavior while moving it behind a clearer Stage 2 transition domain service.
9. Add migration preview/mapping tables only after versioned runtime binding is in place.

## Immediate Next Step

Step B should update seed data to create the official RTK workflow through the existing seed mechanism, but it should be coordinated with the versioning design. If Step B is done before full versioning, keep it idempotent and avoid adding duplicate templates/stages/transitions; if Step C follows immediately, seed should create the official workflow as a published version.

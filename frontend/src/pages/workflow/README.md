# Workflow feature

- `api.ts`, `types.ts`, `mocks.ts` — public feature API and shared contracts. They remain at the root because other features import them.
- `stages/` — business rules, state parsing, validation, and tests for individual workflow stages.
- `components/` — UI components, grouped separately from stage rules.
- `shared/` — cross-stage utilities: stage definitions, transitions, and file validation.
- `backend/` — temporary API-gap specifications and fallback data that must be handed over to backend development.
- `tests/` — feature-level tests that are not owned by a single stage.

Pages and their styles remain at the root as the feature entry points used by the router.

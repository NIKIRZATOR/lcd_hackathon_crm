# Universities feature

- `api.ts`, `types.ts`, `mocks.ts` — public feature API and contracts. They stay at the root because other features use them.
- `domain/` — university business rules, derived card/section data, periods, and workflow integration.
- `catalog/` — catalogue parsing, preview, import, and its tests.
- `components/` — page UI; `components/panels/` contains the detail-page tabs and their shared presentation helpers.

Pages and styles remain at the root as router entry points.

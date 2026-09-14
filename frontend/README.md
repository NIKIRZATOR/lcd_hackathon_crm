# Frontend

React/Vite application for edu_crm.

## Architecture

The frontend uses a simplified Feature-Sliced Design structure:

```text
src/app       global app configuration, providers, router, styles
src/pages     pages
src/widgets   composed UI blocks
src/features  user scenarios and actions
src/entities  business entities
src/shared    reusable API, config, libraries, UI, assets
```

Examples:

- Feature "сменить этап взаимодействия": `src/features/change-interaction-stage/`
- Interaction entity: `src/entities/interaction/`
- Interaction page: `src/pages/interaction/`
- Reusable button: `src/shared/ui/`
- Workflow widget: `src/widgets/workflow/`

Do not import backend source code. Frontend communicates with backend only through HTTP API.

## Local Run

```bash
npm install
npm run dev
```

Environment variables are documented in `.env.example`.

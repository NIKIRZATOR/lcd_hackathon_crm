# Stage 0 Audit

Date: 2026-09-20

## Goal

Stage 0 fixes the project baseline: what actually runs, which modules are real, which modules are stubs, and which engineering contracts are now shared by backend, frontend and CI.

## Smoke Test Results

Commands were run from the repository root on the local Docker Compose stand.

| Check | Command / URL | Result |
| --- | --- | --- |
| Compose services | `docker compose ps -a` | PASSED: `postgres`, `backend`, `frontend`, `keycloak` are up; `keycloak-db-init` exited with code 0. |
| Backend health | `GET http://localhost:8000/api/health` | PASSED: `200 {"status":"ok","service":"backend"}`. |
| Swagger UI | `GET http://localhost:8000/docs` | PASSED: `200`. |
| Frontend UI | `GET http://localhost:5173` | PASSED: `200`. |
| Keycloak discovery | `GET http://localhost:8080/realms/rtk-eduflow/.well-known/openid-configuration` | PASSED: `200`. |
| Alembic current | `docker compose run --rm backend alembic current` | PASSED: `5b0d2fd1f4d8 (head)`. |
| Alembic drift | `docker compose run --rm backend alembic check` | PASSED: `No new upgrade operations detected.` |
| CRM table count | SQL against `information_schema.tables` | PASSED: `21` public tables. |
| Backend tests | `docker compose run --rm backend pytest -q` | PASSED: `7 passed, 1 warning`. |
| Backend lint | `docker compose run --rm backend ruff check app tests` | PASSED: `All checks passed!`. |
| Backend compile | `docker compose run --rm backend python -m compileall app tests` | PASSED. |
| Frontend lint | `docker compose run --rm frontend npm run lint` | PASSED. |
| Frontend build | `docker compose run --rm frontend npm run build` | PASSED; Vite reports one chunk-size warning. |

## Error Contract

Backend errors use one envelope:

```json
{
  "code": "NOT_FOUND",
  "message": "Not Found",
  "details": null,
  "requestId": "..."
}
```

`X-Request-ID` is accepted from the request and returned in the response. If it is absent, backend generates a UUID request id.

## Module Inventory

| Module | Endpoints | Status | Notes |
| --- | --- | --- | --- |
| health | `GET /api/health` | WORKING | Minimal test coverage exists. |
| auth | `GET /api/auth/me`, `GET /api/auth/role-check` | WORKING | JWT/JWKS verification exists; dependency override tests cover role checks. |
| universities | `/api/universities` | WORKING | CRUD-like router exists. Needs DB-backed integration tests. |
| contacts | `/api/university-contacts` | WORKING | CRUD-like router exists. Needs DB-backed integration tests. |
| programs | `/api/it-directions`, `/api/it-programs` | WORKING | CRUD-like router exists. |
| products | `/api/vendors`, `/api/it-products`, `/api/program-products` | WORKING | CRUD-like router exists. |
| interactions | `/api/interactions` | WORKING | Data-scope/RBAC hardening is Stage 1 work. |
| workflows | `/api/workflows/*` | WORKING | Runtime endpoints exist; versioning/governance is later-stage work. |
| analytics | `/api/analytics` | STUB | Router has no operations. |
| audit | `/api/audit` | STUB | Router has no operations. |
| cohorts | `/api/cohorts` | STUB | Router has no operations. |
| documents | `/api/documents` | STUB | Router has no operations. |
| integrations | `/api/integrations` | STUB | Router has no operations. |
| licenses | `/api/licenses` | STUB | Router has no operations. |
| materials | `/api/materials` | STUB | Router has no operations. |
| notifications | `/api/notifications` | STUB | Router has no operations. |
| tasks | `/api/tasks` | STUB | Router has no operations. |
| teachers | `/api/teachers` | STUB | Router has no operations. |
| users | `/api/users` | STUB | Router has no operations. |

## Stage 0 Checklist

| Item | Status | Evidence |
| --- | --- | --- |
| 0.1 Monorepo structure | DONE | Separate backend/frontend apps, Dockerfiles and env examples exist. |
| 0.2 Docker Compose baseline | DONE | Compose defines postgres, backend, frontend, keycloak and keycloak DB init. |
| 0.3 Keycloak realm and roles | DONE | Realm JSON defines clients, roles and test users; final browser smoke still recommended before demo. |
| 0.4 JWT/JWKS backend | DONE | `KeycloakTokenVerifier`, `/api/auth/me`, `/api/auth/role-check` exist. |
| 0.5 CRM migrations | DONE | Alembic migrations exist for CRM schema and roles. |
| 0.6 API/router inventory | DONE | Module table above. |
| 0.7 Unified error envelope | DONE | Global FastAPI handlers installed. |
| 0.8 CI | DONE | `.github/workflows/ci.yml` runs backend lint/tests/compile and frontend lint/build. |
| 0.9 Target ER model | DONE | See `docs/db_architecture.md`. |

## Final P0 Checklist

```bash
docker compose ps -a
docker compose run --rm backend alembic current
docker compose run --rm backend alembic check
docker compose run --rm backend pytest -q
docker compose run --rm backend ruff check app tests
docker compose run --rm backend python -m compileall app tests
docker compose run --rm frontend npm run lint
docker compose run --rm frontend npm run build
```

## Residual Risks

- Browser-based Keycloak login for `kam1`, `manager1`, `admin1`, `viewer1` should be recorded before a demo.
- Working CRUD/workflow modules need DB-backed integration tests beyond the minimal P0 tests.
- Stage 1 still needs server-side data scope for KAM/MANAGER/ADMIN on business endpoints.

# Backend

FastAPI application for edu_crm.

## Architecture

Backend is a modular monolith. New business domains are created inside:

```text
app/modules/<module_name>/
```

When real development of a module starts, it may add files such as:

```text
router.py
schemas.py
models.py
service.py
repository.py
dependencies.py
```

Do not create these files in every module in advance. Do not put business logic into `main.py`, generic `utils.py`, or `common/` unless it is truly shared technical code.

## Local Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Environment variables are documented in `.env.example`.

## Technical Endpoints

- `GET /`
- `GET /api/health`

## Demo Data

Run migrations before loading demo data:

```bash
docker compose run --rm backend alembic upgrade head
```

Seed dictionaries and their links:

```bash
docker compose run --rm backend python scripts/seed_demo_data.py
```

Clear all V1 data from the database:

```bash
docker compose run --rm backend python scripts/clear_demo_data.py
```

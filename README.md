# RTK EduFlow

RTK EduFlow — CRM для сопровождения образовательных организаций и программ. Система поддерживает University 360, взаимодействия, workflow, учебные программы и заходы, задачи/NBA, документы, аналитику, отчёты, пользователей и интеграционные сигналы.

## Состав системы

- `frontend` — React/Vite web-интерфейс;
- `backend` — FastAPI REST API и бизнес-логика;
- `worker` — генерация отчётов из Redis-очереди;
- PostgreSQL — данные CRM и Keycloak;
- MinIO — документы, вложения и отчёты;
- Keycloak — вход и роли `KAM`, `MANAGER`, `ADMIN`;
- `mock-lms`, ClamAV и Nginx — профильные сервисы для интеграций, проверки файлов и demo-контура.

## Требования

- Docker Desktop с Docker Compose v2;
- для локальной frontend-разработки — Node.js 20+;
- для backend-проверок — Python 3.11+;
- для нагрузочного тестирования — [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/).

## Быстрый запуск

В PowerShell из корня репозитория:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python scripts/seed_demo_data.py
docker compose ps
```

| Что проверить | Адрес |
| --- | --- |
| Web-интерфейс | http://localhost:5173 |
| API / Swagger | http://localhost:8000/docs |
| Health-check | http://localhost:8000/api/health |
| Keycloak | http://localhost:8080 |
| MinIO Console | http://localhost:9001 |

Health-check должен вернуть `{"status":"ok","service":"backend"}`.

## Сборка и demo-контур

Пересобрать и запустить стандартный контур:

```powershell
docker compose up -d --build
```

Demo-контур публикует Nginx на `http://localhost:8088` и позволяет масштабировать backend:

```powershell
$env:BACKEND_REPLICAS = "3"
make demo
```

Альтернатива без Makefile:

```powershell
$env:VITE_API_URL = "http://localhost:8088"
docker compose -f docker-compose.yml -f docker-compose.demo.yml --profile demo up -d --build --scale backend=3
```

Frontend без Docker:

```powershell
Set-Location frontend
npm install
npm run dev
```

## Авторизация

При первом запуске импортируется realm из `keycloak/realm/rtk-eduflow-realm.json`.

| Пользователь | Пароль | Роль |
| --- | --- | --- |
| `kam1` | `kam1` | KAM |
| `manager1` | `manager1` | MANAGER |
| `admin1` | `admin1` | ADMIN |
| `viewer1` | `viewer1` | Нет CRM-доступа |

Откройте `http://localhost:5173/login`, нажмите «Войти через Keycloak» и используйте тестовую учётную запись. `/api/auth/me` без Bearer JWT возвращает `401`.

## Как проверить систему

1. Войдите в UI как `kam1 / kam1`: проверьте главную страницу, организации, программы, workflow, задачи и отчёты.
2. Войдите как `admin1 / admin1`: проверьте управление, пользователей, интеграции и аудит.
3. Откройте Swagger и выполните `GET /api/health`.
4. Проверьте контейнеры: `docker compose ps`.

Автоматические проверки:

```powershell
Set-Location backend
pytest

Set-Location ..\frontend
npm run test
npm run build

Set-Location ..
docker compose config --quiet
```

## Нагрузочные проверки

Подробности: [docs/evidence/load-tests/README.md](docs/evidence/load-tests/README.md).

### 50 параллельных пользователей

Получите JWT до запуска теста:

```powershell
$form = @{ client_id = "rtk-eduflow-frontend"; grant_type = "password"; username = "admin1"; password = "admin1" }
$env:JWT_TOKEN = (Invoke-RestMethod -Method Post -Uri "http://localhost:8080/realms/rtk-eduflow/protocol/openid-connect/token" -ContentType "application/x-www-form-urlencoded" -Body $form).access_token
$env:BASE_URL = "http://localhost:8000"
k6 run --summary-export docs/evidence/load-tests/results/k6_50_users_summary.json tests/load/k6_50_users.js
```

PASS: 50 виртуальных пользователей за 120 секунд, HTTP errors < 1%, p95 < 1000 мс, HTTP 5xx = 0.

### 10 параллельных отчётов

```powershell
$env:REPORT_WORKER_CONCURRENCY = "10"
docker compose up -d --force-recreate worker
python tests/load/enqueue_10_reports.py
```

Результат сохраняется в `docs/evidence/load-tests/results/reports_10_parallel.json`. PASS: 10 заданий `DONE`, нет `FAILED`/`LOST`, одновременно выполнялись минимум 10 jobs.

## Безопасность и резервное копирование

Security contour демонстрационный и не является заявлением о соответствии 152-ФЗ или требованиям ФСТЭК. Перед недемо-развёртыванием замените все секреты в `.env`; не храните их в Git.

```powershell
# Антивирусная проверка файлов
docker compose --profile antivirus up -d --build

# Backup и проверка backup
docker compose --profile backup run --rm backup all
docker compose --profile backup run --rm backup verify
```

Для шифрования backup и персональных данных задайте `BACKUP_ENCRYPTION_KEY`, `PII_ENCRYPTION_KEY` и `PII_HMAC_PEPPER`.

## Остановка и сброс demo-данных

```powershell
docker compose down
```

Полный сброс Docker volumes:

```powershell
docker compose down -v
docker compose up -d --build
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python scripts/seed_demo_data.py
```

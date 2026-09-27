# Эксплуатация RTK EduFlow

## Подготовка

Из корня репозитория создайте локальный файл конфигурации:

```powershell
Copy-Item .env.example .env
```

Для обычной разработки достаточно значений по умолчанию. Не добавляйте реальные секреты в Git.

## Лёгкий dev-режим

Запускает frontend, один backend, PostgreSQL, MinIO, Keycloak, Redis и worker. Nginx, несколько backend-экземпляров и backup scheduler не запускаются.

```powershell
docker compose up --build
```

Первичное применение миграций:

```powershell
docker compose run --rm backend alembic upgrade head
```

Адреса сервисов:

| Сервис | Адрес |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend / Swagger | `http://localhost:8000/docs` |
| Health | `http://localhost:8000/health` |
| Readiness | `http://localhost:8000/ready` |
| Keycloak | `http://localhost:8080` |
| MinIO Console | `http://localhost:9001` |

`/health` показывает, что процесс backend запущен. `/ready` дополнительно проверяет доступность PostgreSQL и возвращает `503`, если экземпляр не готов принимать запросы.

## Demo: Nginx и несколько backend

В demo backend не публикует порт напрямую: запросы проходят через Nginx. Все backend-экземпляры используют одни PostgreSQL, MinIO, Keycloak и Redis.

```powershell
$env:VITE_API_URL = "http://localhost:8088"
docker compose -f docker-compose.yml -f docker-compose.demo.yml --profile demo up --build --scale backend=3
```

API и Swagger в demo:

```text
http://localhost:8088/health
http://localhost:8088/ready
http://localhost:8088/docs
```

Чтобы продемонстрировать распределение запросов, временно установите в `.env`:

```env
ENABLE_DIAGNOSTIC_HEADERS=true
```

После пересоздания backend ответ через Nginx будет содержать `X-Backend-Instance`. В штатном режиме оставьте значение `false`.

После demo удалите временную переменную перед обычным запуском frontend:

```powershell
Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
```

## Резервное копирование

Backup profile выключен по умолчанию. Архивы хранятся в `data/backups/`, исключённом из Git. Путь, сроки хранения и интервал настраиваются в `.env`:

```env
BACKUP_LOCAL_PATH=./data/backups
BACKUP_INTERVAL_SECONDS=86400
BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=4
BACKUP_RETENTION_MONTHLY=3
```

Полный backup PostgreSQL, всех MinIO buckets и realm export Keycloak:

```powershell
docker compose --profile backup run --rm backup all
```

Отдельные компоненты:

```powershell
docker compose --profile backup run --rm backup postgres
docker compose --profile backup run --rm backup minio
docker compose --profile backup run --rm backup keycloak
```

Проверка checksum:

```powershell
docker compose --profile backup run --rm backup verify
```

Периодический scheduler (выполняет backup раз в `BACKUP_INTERVAL_SECONDS`):

```powershell
docker compose --profile backup-scheduler up backup-scheduler
```

## Восстановление

Перед восстановлением остановите backend и worker. Сначала выполните проверку checksum. В командах используется путь внутри backup-контейнера, то есть `/backups/...`, а не `data/backups/...` с хоста.

```powershell
docker compose --profile backup run --rm backup restore-postgres /backups/postgres/daily/postgres_YYYY-MM-DD_HH-MM-SS.dump
docker compose --profile backup run --rm backup restore-minio /backups/minio/daily/minio_YYYY-MM-DD_HH-MM-SS
```

Keycloak realm импортируется отдельно штатными средствами Keycloak при остановленном сервисе. При полном восстановлении PostgreSQL база Keycloak восстанавливается вместе с PostgreSQL.

После восстановления запустите сервисы, при необходимости примените миграции и проверьте `/health`, `/ready`, login и доступ к файлам MinIO.

## Нагрузочное тестирование

Нагрузочный тест не запускается автоматически. После запуска demo установите k6 на отдельной машине и используйте только тестовые данные:

```powershell
k6 run --vus 10 --duration 30s --env BASE_URL=http://localhost:8088 scripts/load-test.js
```

## Makefile

При наличии GNU Make доступны короткие команды: `make dev`, `make demo`, `make backup`, `make backup-postgres`, `make backup-minio`, `make backup-keycloak` и `make backup-test`.

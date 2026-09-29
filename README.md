# RTK EduFlow

## Security contour (demo)

The project includes a minimal technical security contour; it is not a claim of compliance with 152-FZ or FSTEC requirements.

### Environment

Copy `.env.example` to `.env` for a local stand. Replace every `dev-only-*` value before any non-demo deployment. Keep all secrets out of Git.

```env
ANTIVIRUS_ENABLED=true
PII_ENCRYPTION_ENABLED=true
PII_ENCRYPTION_KEY=<url-safe-base64-of-32-random-bytes>
PII_HMAC_PEPPER=<random-secret>
BACKUP_ENCRYPTION_ENABLED=true
BACKUP_ENCRYPTION_KEY=<separate-random-secret>
```

`PII_HMAC_PEPPER` is used for deterministic HMAC-SHA-256 matching of normalized email and phone values. It must be set whenever B2C/integration matching is enabled. `BACKUP_ENCRYPTION_KEY` must never equal the PII encryption key.

### Antivirus

Start the optional ClamAV service with no host port published:

```bash
docker compose --profile antivirus up -d --build
docker compose ps clamav
```

With `ANTIVIRUS_ENABLED=true`, workflow attachments, organization logos and import files are scanned before MinIO storage. `CLEAN` files are stored; `INFECTED` files are rejected with HTTP 422; an unavailable scanner returns HTTP 503. The scan result is persisted in `files.scan_status` and audit metadata.

### Encrypted backup and restore

With backup encryption enabled, PostgreSQL, MinIO and Keycloak snapshots are stored as `.enc` only. The backup container uses AES-256-CBC with PBKDF2; plaintext is removed after successful encryption.

```bash
docker compose --profile backup run --rm backup all
docker compose --profile backup run --rm backup verify
docker compose --profile backup run --rm backup restore-postgres /backups/postgres/daily/postgres_YYYY-MM-DD_HH-MM-SS.dump.enc
docker compose --profile backup run --rm backup restore-minio /backups/minio/daily/minio_YYYY-MM-DD_HH-MM-SS.tar.gz.enc
```

Use the same `BACKUP_ENCRYPTION_KEY` for backup and restore. Stop backend and worker before a real restore. MinIO server-side encryption is not enabled because its production-grade configuration requires external KMS/KES; RBAC, antivirus checks and encrypted backups remain the current protection controls.

Короткая инструкция для запуска проекта локально.

## Запуск

Из корня репозитория выполните:

```bash
docker compose up --build
```

В отдельном терминале примените миграции CRM:

```bash
docker compose run --rm backend alembic upgrade head
```

После запуска откройте сайт:

```text
http://localhost:5173
```

## Где проверить

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:8000
```

Swagger:

```text
http://localhost:8000/docs
```

Health endpoint:

```text
http://localhost:8000/api/health
```

Keycloak:

```text
http://localhost:8080
```

Ожидаемый ответ:

```json
{
  "status": "ok",
  "service": "backend"
}
```

## Keycloak

При первом запуске Docker Compose импортирует realm из:

```text
keycloak/realm/rtk-eduflow-realm.json
```

Создаются:

- realm `rtk-eduflow`;
- SPA client `rtk-eduflow-frontend` с Authorization Code Flow + PKCE;
- backend client/audience `rtk-eduflow-backend`;
- роли `KAM`, `MANAGER`, `ADMIN`;
- dev-пользователи `kam1`, `manager1`, `admin1`, `viewer1`.

Локальные пароли тестовых пользователей совпадают с логинами. Это только dev-настройка для локальной проверки.

Админ-консоль Keycloak:

```text
http://localhost:8080
```

Значения по умолчанию:

```text
admin / admin
```

Их можно поменять через `.env`.

Если `postgres_data` уже существовал до добавления Keycloak, одноразовый сервис `keycloak-db-init` создаст БД `keycloak` при следующем `docker compose up`.

## Проверка авторизации

1. Откройте:

```text
http://localhost:5173/login
```

2. Нажмите `Войти через Keycloak`.
3. Войдите как `kam1 / kam1`.
4. После возврата в приложение frontend запросит:

```text
GET http://localhost:8000/api/auth/me
```

Ожидаемый ответ содержит:

```json
{
  "username": "kam1",
  "roles": ["KAM"]
}
```

Без Bearer token endpoint `/api/auth/me` должен возвращать `401`.

Проверка ролей:

```text
GET http://localhost:8000/api/auth/role-check
```

С пользователями `kam1`, `manager1`, `admin1` ожидается `200`. С `viewer1` ожидается `403`.

## Остановка

```bash
docker compose down
```

```bash
docker compose down -v
docker compose up -d --build
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python scripts/seed_demo_data.py
```

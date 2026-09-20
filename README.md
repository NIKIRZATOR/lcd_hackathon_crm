# RTK EduFlow

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

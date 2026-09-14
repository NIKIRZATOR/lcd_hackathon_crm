# edu_crm

Короткая инструкция для запуска проекта локально.

## Запуск

Из корня репозитория выполните:

```bash
docker compose up --build
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

Ожидаемый ответ:

```json
{
  "status": "ok",
  "service": "backend"
}
```

## Остановка

```bash
docker compose down
```

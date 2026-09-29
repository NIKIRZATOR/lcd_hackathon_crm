# Резервное копирование

Профиль `backup` предназначен для ручных запусков. В обычном dev-режиме автоматически работает `backup-scheduler`, который создаёт custom-format `pg_dump` CRM БД, зеркальную копию всех доступных MinIO buckets и Keycloak partial realm export. Keycloak также находится в отдельной БД PostgreSQL; её восстановление описано отдельно.

```bash
make backup
make backup-postgres
make backup-minio
make backup-keycloak
make backup-test
make backup-schedule
```

Архивы и checksum хранятся в `data/backups/` (путь задаёт `BACKUP_LOCAL_PATH` и он исключён из Git). Успешный PostgreSQL dump записывается через временный файл и публикуется только после завершения. MinIO backup содержит manifest и checksum всех объектов. Текущая retention-политика удаляет daily snapshots старше `BACKUP_RETENTION_DAILY` дней.

`make backup-schedule` запускает сервис с интервалом `BACKUP_INTERVAL_SECONDS`; по умолчанию это один запуск в сутки. Weekly и monthly snapshots формируются из daily в воскресенье и в первый день месяца; их retention задают `BACKUP_RETENTION_WEEKLY` (в неделях) и `BACKUP_RETENTION_MONTHLY` (в месяцах).

Не резервируются Docker images, исходный код и секреты из `.env`. Для внешнего хранилища следует копировать весь каталог backup в защищённое object storage после проверки checksum.

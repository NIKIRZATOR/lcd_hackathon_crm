# Восстановление

Сначала остановите frontend, backend и worker, затем выберите проверенный backup внутри `data/backups`.

```bash
make restore-postgres BACKUP=/backups/postgres/daily/postgres_YYYY-MM-DD_HH-MM-SS.dump
make restore-minio BACKUP=/backups/minio/daily/minio_YYYY-MM-DD_HH-MM-SS
```

Команды разрешают пути только внутри соответствующего backup-каталога. Перед восстановлением запускайте `make backup-test`.

Для Keycloak остановите сервис Keycloak, импортируйте saved partial realm export штатным Admin API или `kc.sh import`, затем запустите Keycloak и проверьте вход. При полном восстановлении PostgreSQL Keycloak DB восстанавливается вместе с PostgreSQL, поэтому realm import требуется только при раздельном восстановлении конфигурации.

После восстановления запустите миграции при необходимости и проверьте `/health`, `/ready`, доступ к MinIO и login.

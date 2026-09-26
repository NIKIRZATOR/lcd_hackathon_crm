# Disaster recovery

1. Получите проверенный release и создайте `.env` без секретов из Git.
2. Поднимите PostgreSQL, MinIO и Keycloak.
3. Проверьте checksum backup и восстановите PostgreSQL, MinIO и при необходимости Keycloak realm.
4. Поднимите backend и worker, выполните миграции только если версия release этого требует.
5. Проверьте `/health`, `/ready`, login и smoke-сценарий с файлом MinIO.

Целевые RPO/RTO зависят от внешнего расписания копирования и размера данных; до настройки внешнего backup storage они не гарантируются.

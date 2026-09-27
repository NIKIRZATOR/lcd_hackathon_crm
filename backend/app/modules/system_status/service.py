from datetime import datetime, timezone
from typing import Callable
from urllib.request import urlopen

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.storage import get_storage_adapter


class PlatformStatusService:
    """Collect non-sensitive availability signals for ADMIN Home."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def summary(self) -> list[dict[str, str]]:
        checked_at = datetime.now(timezone.utc).isoformat()
        return [
            self._ok("Backend", "API отвечает", checked_at),
            self._check("PostgreSQL", "Подключение к базе доступно", checked_at, self._check_database),
            self._check("Redis", "Очередь отчётов доступна", checked_at, self._check_redis),
            self._check("MinIO", "Файловое хранилище доступно", checked_at, self._check_storage),
            self._check("Keycloak", "OpenID-конфигурация доступна", checked_at, self._check_keycloak),
            {"component": "Report worker", "status": "Unknown", "detail": "Heartbeat worker пока не реализован", "checked_at": checked_at},
        ]

    def _check_database(self) -> None:
        self.db.execute(text("SELECT 1"))

    @staticmethod
    def _check_redis() -> None:
        from redis import Redis

        client = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        client.ping()
        client.llen(settings.report_queue_name)

    @staticmethod
    def _check_storage() -> None:
        get_storage_adapter().healthcheck()

    @staticmethod
    def _check_keycloak() -> None:
        with urlopen(settings.keycloak_openid_configuration_url, timeout=2) as response:
            if response.status != 200:
                raise RuntimeError("Keycloak OpenID configuration is unavailable")

    @staticmethod
    def _ok(component: str, detail: str, checked_at: str) -> dict[str, str]:
        return {"component": component, "status": "OK", "detail": detail, "checked_at": checked_at}

    def _check(self, component: str, detail: str, checked_at: str, probe: Callable[[], None]) -> dict[str, str]:
        try:
            probe()
        except Exception:
            return {"component": component, "status": "Error", "detail": "Компонент недоступен", "checked_at": checked_at}
        return self._ok(component, detail, checked_at)

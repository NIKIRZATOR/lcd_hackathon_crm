from datetime import datetime, timezone
import json
from pathlib import Path
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
            self._check("Redis", "Кэш и брокер очередей доступны", checked_at, self._check_redis),
            self._report_queue_status(checked_at),
            self._check("MinIO", "Файловое хранилище доступно", checked_at, self._check_storage),
            self._check("Keycloak", "OpenID-конфигурация доступна", checked_at, self._check_keycloak),
            self._backup_scheduler_status(checked_at),
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

    @staticmethod
    def _report_queue_status(checked_at: str) -> dict[str, str]:
        try:
            from redis import Redis

            client = Redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            queue_size = client.llen(settings.report_queue_name)
        except Exception:
            return {
                "component": "Report queue",
                "status": "Error",
                "detail": "Очередь отчётов недоступна",
                "checked_at": checked_at,
            }
        return {
            "component": "Report queue",
            "status": "OK",
            "detail": f"Заданий в очереди: {queue_size}",
            "checked_at": checked_at,
        }

    @staticmethod
    def _backup_scheduler_status(checked_at: str) -> dict[str, str]:
        backup = BackupStatusService().last_successful_backup()
        completed_at = backup["last_successful_backup_at"]
        heartbeat_at = backup["scheduler_last_heartbeat_at"]
        if backup["scheduler_alive"]:
            detail = "Планировщик резервного копирования работает"
            if completed_at:
                detail += f". Последний полный backup: {completed_at}"
            else:
                detail += ". Полный backup ещё не завершён"
            status = "OK"
        else:
            detail = "Нет актуального heartbeat планировщика резервного копирования"
            if completed_at:
                detail += f". Последний полный backup: {completed_at}"
            status = "Error"
        return {
            "component": "Backup scheduler",
            "status": status,
            "detail": detail,
            "checked_at": heartbeat_at or checked_at,
        }

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


class BackupStatusService:
    """Read the marker written after a complete successful backup."""

    def __init__(
        self,
        status_path: Path | None = None,
        heartbeat_path: Path | None = None,
        heartbeat_ttl_seconds: int | None = None,
    ) -> None:
        self.status_path = status_path or settings.backup_status_path
        self.heartbeat_path = heartbeat_path or settings.backup_heartbeat_path
        self.heartbeat_ttl_seconds = heartbeat_ttl_seconds or settings.backup_heartbeat_ttl_seconds

    def last_successful_backup(self) -> dict[str, object | None]:
        completed_at, components = self._read_backup_marker()
        heartbeat_at = self._read_timestamp(self.heartbeat_path, "updated_at")
        return {
            "scheduler_alive": self._is_scheduler_alive(heartbeat_at),
            "scheduler_last_heartbeat_at": heartbeat_at,
            "last_successful_backup_at": completed_at,
            "components": components,
        }

    def _read_backup_marker(self) -> tuple[str | None, list[object]]:
        try:
            payload = json.loads(self.status_path.read_text(encoding="utf-8"))
            completed_at = payload["completed_at"]
            components = payload["components"]
            if not isinstance(completed_at, str) or not isinstance(components, list):
                raise ValueError("Invalid backup status payload")
        except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
            return None, []
        return completed_at, components

    @staticmethod
    def _read_timestamp(path: Path, field: str) -> str | None:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))[field]
            if not isinstance(value, str):
                raise ValueError("Invalid timestamp")
            return value
        except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
            return None

    def _is_scheduler_alive(self, heartbeat_at: str | None) -> bool:
        if heartbeat_at is None:
            return False
        try:
            heartbeat = datetime.fromisoformat(heartbeat_at.replace("Z", "+00:00"))
        except ValueError:
            return False
        return (datetime.now(timezone.utc) - heartbeat).total_seconds() <= self.heartbeat_ttl_seconds

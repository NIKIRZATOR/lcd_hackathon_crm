import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.auth.dependencies import get_current_user
from app.modules.system_status.service import BackupStatusService
from app.modules.users.model import Role, User


def make_admin() -> User:
    return User(
        id=uuid4(),
        keycloak_user_id=uuid4(),
        username="admin",
        full_name="Admin",
        email="admin@example.local",
        role="ADMIN",
        is_active=True,
        roles=[Role(id=uuid4(), name="ADMIN", description="Admin")],
    )


def test_returns_last_complete_backup_marker(tmp_path) -> None:
    marker = tmp_path / "last-successful.json"
    heartbeat = tmp_path / "scheduler-heartbeat.json"
    heartbeat_at = datetime.now(timezone.utc).isoformat()
    marker.write_text(
        json.dumps(
            {
                "completed_at": "2026-09-29T10:00:00Z",
                "components": ["postgres", "minio", "keycloak"],
            }
        ),
        encoding="utf-8",
    )
    heartbeat.write_text(json.dumps({"updated_at": heartbeat_at}), encoding="utf-8")

    result = BackupStatusService(marker, heartbeat).last_successful_backup()

    assert result == {
        "scheduler_alive": True,
        "scheduler_last_heartbeat_at": heartbeat_at,
        "last_successful_backup_at": "2026-09-29T10:00:00Z",
        "components": ["postgres", "minio", "keycloak"],
    }


def test_returns_empty_status_when_marker_is_missing(tmp_path) -> None:
    result = BackupStatusService(tmp_path / "missing.json", tmp_path / "missing-heartbeat.json").last_successful_backup()

    assert result == {
        "scheduler_alive": False,
        "scheduler_last_heartbeat_at": None,
        "last_successful_backup_at": None,
        "components": [],
    }


def test_reports_stale_scheduler_heartbeat(tmp_path) -> None:
    heartbeat = tmp_path / "scheduler-heartbeat.json"
    heartbeat.write_text(
        json.dumps({"updated_at": (datetime.now(timezone.utc) - timedelta(minutes=4)).isoformat()}),
        encoding="utf-8",
    )

    result = BackupStatusService(tmp_path / "missing.json", heartbeat).last_successful_backup()

    assert result["scheduler_alive"] is False


def test_admin_can_read_backup_status() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = make_admin

    response = TestClient(app).get("/api/system/backup")

    assert response.status_code == 200
    assert set(response.json()) == {
        "scheduler_alive",
        "scheduler_last_heartbeat_at",
        "last_successful_backup_at",
        "components",
    }

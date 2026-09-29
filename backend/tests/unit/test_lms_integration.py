from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import settings
from app.main import create_app
from app.modules.integrations.schemas import LmsEventCreate


def test_lms_event_allows_only_supported_types() -> None:
    event = LmsEventCreate(
        event_id="evt-1",
        external_program_id="LMS-1",
        type="STUDENT_ENROLLED",
        data={"student_count": 35},
    )

    assert event.data["student_count"] == 35

    try:
        LmsEventCreate(event_id="evt-2", external_program_id="LMS-1", type="UNKNOWN")
    except ValidationError:
        pass
    else:
        raise AssertionError("Unsupported LMS event type must be rejected")


def test_lms_callback_rejects_invalid_service_token(monkeypatch) -> None:
    monkeypatch.setattr(settings, "lms_service_token", "test-token")

    response = TestClient(create_app()).post(
        "/api/integrations/lms/events",
        headers={"X-LMS-Service-Token": "wrong-token"},
        json={
            "event_id": "evt-invalid-token",
            "external_program_id": "LMS-1",
            "type": "STUDENT_ENROLLED",
            "data": {"student_count": 1},
        },
    )

    assert response.status_code == 401

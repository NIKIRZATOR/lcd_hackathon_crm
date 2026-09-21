from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.auth.dependencies import get_current_user
from app.modules.users.model import Role, User


def make_user(*roles: str) -> User:
    return User(
        id=uuid4(),
        keycloak_user_id=uuid4(),
        username="test-user",
        full_name="Test User",
        email="test@example.local",
        role=roles[0] if roles else "USER",
        is_active=True,
        roles=[Role(id=uuid4(), name=role, description=f"{role} role") for role in roles],
    )


def test_not_found_uses_error_envelope() -> None:
    client = TestClient(create_app())

    response = client.get("/api/missing", headers={"X-Request-ID": "stage0-test"})

    assert response.status_code == 404
    assert response.headers["X-Request-ID"] == "stage0-test"
    assert response.json() == {
        "code": "NOT_FOUND",
        "message": "Not Found",
        "details": None,
        "requestId": "stage0-test",
    }


def test_validation_error_uses_error_envelope() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: make_user("ADMIN")
    client = TestClient(app)

    response = client.get("/api/universities", params={"limit": 0})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert body["message"] == "Request validation failed"
    assert body["requestId"]
    assert isinstance(body["details"], list)

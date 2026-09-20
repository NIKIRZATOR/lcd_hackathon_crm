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


def test_auth_me_can_use_mocked_current_user() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: make_user("ADMIN")
    client = TestClient(app)

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json()["roles"] == ["ADMIN"]


def test_role_check_accepts_allowed_mocked_role() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: make_user("KAM")
    client = TestClient(app)

    response = client.get("/api/auth/role-check")

    assert response.status_code == 200
    assert response.json()["roles"] == ["KAM"]


def test_role_check_rejects_disallowed_mocked_role() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: make_user("VIEWER")
    client = TestClient(app)

    response = client.get("/api/auth/role-check")

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_auth_me_requires_token_without_mock() -> None:
    client = TestClient(create_app())

    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.auth.dependencies import get_current_user
from app.modules.users.model import Role, User


def make_user(role: str) -> User:
    return User(
        id=uuid4(),
        keycloak_user_id=uuid4(),
        username=role.lower(),
        full_name=role,
        email=f"{role.lower()}@example.local",
        role=role,
        is_active=True,
        roles=[Role(id=uuid4(), name=role, description=role)],
    )


@pytest.mark.parametrize("role", ["KAM", "MANAGER"])
@pytest.mark.parametrize(
    "path",
    [
        "/api/integrations/sources",
        "/api/integrations/diagnostics",
        "/api/integrations/signals",
    ],
)
def test_non_admin_cannot_read_integration_diagnostics(role: str, path: str) -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: make_user(role)

    response = TestClient(app).get(path)

    assert response.status_code == 403

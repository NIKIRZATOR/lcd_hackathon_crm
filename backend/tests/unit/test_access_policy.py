from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.auth.access import (
    ensure_can_assign_interaction,
    ensure_can_read_interaction,
    ensure_can_update_interaction,
    resolve_interaction_manager_filter,
)
from app.modules.auth.dependencies import get_current_user
from app.modules.interactions.model import UniversityInteraction
from app.modules.interactions.schemas import UniversityInteractionAssign, UniversityInteractionUpdate
from app.modules.interactions.service import UniversityInteractionService
from app.modules.users.model import ResponsibleAssignmentHistory, Role, User


def make_user(*roles: str, user_id=None) -> User:
    return User(
        id=user_id or uuid4(),
        keycloak_user_id=uuid4(),
        username="test-user",
        full_name="Test User",
        email="test@example.local",
        role=roles[0] if roles else "USER",
        is_active=True,
        roles=[Role(id=uuid4(), name=role, description=f"{role} role") for role in roles],
    )


def make_interaction(manager_user_id) -> UniversityInteraction:
    return UniversityInteraction(
        id=uuid4(),
        university_id=uuid4(),
        program_id=uuid4(),
        product_id=uuid4(),
        manager_user_id=manager_user_id,
        workflow_template_id=uuid4(),
        status="ACTIVE",
    )


def test_kam_interaction_filter_is_forced_to_self() -> None:
    user = make_user("KAM")

    assert resolve_interaction_manager_filter(db=None, current_user=user, requested_manager_user_id=None) == user.id


def test_kam_cannot_filter_interactions_by_another_manager() -> None:
    user = make_user("KAM")

    with pytest.raises(HTTPException) as error:
        resolve_interaction_manager_filter(db=None, current_user=user, requested_manager_user_id=uuid4())

    assert error.value.status_code == 403


def test_manager_interaction_filter_is_limited_to_subordinates(monkeypatch: pytest.MonkeyPatch) -> None:
    manager = make_user("MANAGER")
    kam_id = uuid4()
    monkeypatch.setattr("app.modules.auth.access.get_subordinate_kam_ids", lambda db, manager_user_id: {kam_id})

    assert resolve_interaction_manager_filter(
        db=None,
        current_user=manager,
        requested_manager_user_id=None,
    ) == {kam_id}
    assert (
        resolve_interaction_manager_filter(
            db=None,
            current_user=manager,
            requested_manager_user_id=kam_id,
        )
        == kam_id
    )


def test_manager_cannot_filter_by_non_subordinate(monkeypatch: pytest.MonkeyPatch) -> None:
    manager = make_user("MANAGER")
    monkeypatch.setattr("app.modules.auth.access.get_subordinate_kam_ids", lambda db, manager_user_id: {uuid4()})

    with pytest.raises(HTTPException) as error:
        resolve_interaction_manager_filter(
            db=None,
            current_user=manager,
            requested_manager_user_id=uuid4(),
        )

    assert error.value.status_code == 403


def test_manager_can_assign_subordinate_interaction_to_subordinate(monkeypatch: pytest.MonkeyPatch) -> None:
    manager = make_user("MANAGER")
    old_kam_id = uuid4()
    new_kam_id = uuid4()
    interaction = make_interaction(old_kam_id)
    monkeypatch.setattr(
        "app.modules.auth.access.get_subordinate_kam_ids",
        lambda db, manager_user_id: {old_kam_id, new_kam_id},
    )

    ensure_can_assign_interaction(None, manager, interaction, new_kam_id)


def test_manager_cannot_assign_interaction_to_non_subordinate(monkeypatch: pytest.MonkeyPatch) -> None:
    manager = make_user("MANAGER")
    interaction = make_interaction(uuid4())
    monkeypatch.setattr("app.modules.auth.access.get_subordinate_kam_ids", lambda db, manager_user_id: {uuid4()})

    with pytest.raises(HTTPException) as error:
        ensure_can_assign_interaction(None, manager, interaction, uuid4())

    assert error.value.status_code == 403


def test_admin_interaction_filter_is_not_forced() -> None:
    user = make_user("ADMIN")
    requested_manager_id = uuid4()

    assert (
        resolve_interaction_manager_filter(
            db=None,
            current_user=user,
            requested_manager_user_id=requested_manager_id,
        )
        == requested_manager_id
    )


def test_admin_interaction_filter_without_manager_returns_all_scope() -> None:
    user = make_user("ADMIN")

    assert resolve_interaction_manager_filter(db=None, current_user=user, requested_manager_user_id=None) is None


def test_kam_can_read_own_interaction() -> None:
    user = make_user("KAM")
    interaction = make_interaction(user.id)

    ensure_can_read_interaction(None, user, interaction)


def test_kam_cannot_read_another_interaction(monkeypatch: pytest.MonkeyPatch) -> None:
    user = make_user("KAM")
    interaction = make_interaction(uuid4())
    monkeypatch.setattr("app.modules.auth.access._has_explicit_scope", lambda *args, **kwargs: False)

    with pytest.raises(HTTPException) as error:
        ensure_can_read_interaction(None, user, interaction)

    assert error.value.status_code == 403


def test_kam_cannot_update_restricted_interaction_fields() -> None:
    user = make_user("KAM")
    interaction = make_interaction(user.id)
    payload = UniversityInteractionUpdate(manager_user_id=uuid4())

    with pytest.raises(HTTPException) as error:
        ensure_can_update_interaction(None, user, interaction, payload)

    assert error.value.status_code == 403


def test_business_endpoint_requires_token() -> None:
    client = TestClient(create_app())

    response = client.get("/api/interactions")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_kam_cannot_request_another_manager_scope() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: make_user("KAM")
    client = TestClient(app)

    response = client.get(f"/api/interactions?manager_user_id={uuid4()}")

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_business_endpoint_rejects_wrong_role() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: make_user("VIEWER")
    client = TestClient(app)

    response = client.get("/api/interactions")

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_patch_rejects_manager_user_id_assignment() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: make_user("ADMIN")
    client = TestClient(app)

    response = client.patch(f"/api/interactions/{uuid4()}", json={"manager_user_id": str(uuid4())})

    assert response.status_code in {400, 404}


def test_assignment_writes_history() -> None:
    class FakeDb:
        def __init__(self) -> None:
            self.added = []
            self.executed = []
            self.committed = False

        def get(self, model, entity_id):
            if model is User:
                return make_user("KAM", user_id=entity_id)
            return None

        def add(self, entity):
            self.added.append(entity)

        def execute(self, statement):
            self.executed.append(statement)

        def commit(self):
            self.committed = True

        def refresh(self, entity):
            return None

    old_manager_id = uuid4()
    new_manager_id = uuid4()
    changed_by_id = uuid4()
    interaction = make_interaction(old_manager_id)
    db = FakeDb()
    service = UniversityInteractionService(db)
    service.get_interaction = lambda interaction_id: interaction

    result = service.assign_interaction(
        interaction.id,
        UniversityInteractionAssign(manager_user_id=new_manager_id, reason="handoff"),
        changed_by_user_id=changed_by_id,
    )

    history = next(entity for entity in db.added if isinstance(entity, ResponsibleAssignmentHistory))
    assert result.manager_user_id == new_manager_id
    assert history.interaction_id == interaction.id
    assert history.old_manager_user_id == old_manager_id
    assert history.new_manager_user_id == new_manager_id
    assert history.changed_by_user_id == changed_by_id
    assert history.reason == "handoff"
    assert db.committed is True

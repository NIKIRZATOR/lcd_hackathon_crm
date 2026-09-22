from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.database import get_db_session
from app.main import create_app
from app.modules.auth.dependencies import get_current_user
from app.modules.audit.model import AuditEvent
from app.modules.interactions.model import UniversityInteraction
from app.modules.users.model import Role, User
from app.modules.workflows.model import (
    WorkflowStage,
    WorkflowStageInstance,
    WorkflowTransition,
    WorkflowTransitionHistory,
)
from app.modules.workflows.schemas import WorkflowTransitionExecute
from app.modules.workflows.service import TransitionService


class FakeTransitionRepository:
    def __init__(self, transition: WorkflowTransition | None) -> None:
        self.transition = transition

    def get_allowed_transition(self, **kwargs) -> WorkflowTransition | None:
        return self.transition


class FailingAuditRepository:
    def add(self, event: AuditEvent) -> AuditEvent:
        raise RuntimeError("audit failed")


class FakeDb:
    def __init__(
        self,
        *,
        interaction: UniversityInteraction,
        current_instance: WorkflowStageInstance,
        next_instance: WorkflowStageInstance,
        current_stage: WorkflowStage,
        next_stage: WorkflowStage,
        performer: User,
        scalar_results: list | None = None,
    ) -> None:
        self.entities = {
            (UniversityInteraction, interaction.id): interaction,
            (WorkflowStageInstance, current_instance.id): current_instance,
            (WorkflowStage, current_stage.id): current_stage,
            (WorkflowStage, next_stage.id): next_stage,
            (User, performer.id): performer,
        }
        self.next_instance = next_instance
        self.scalar_results = scalar_results or []
        self.added = []
        self.committed = False
        self.rolled_back = False

    def get(self, model, entity_id, **kwargs):
        return self.entities.get((model, entity_id))

    def scalar(self, statement):
        if self.scalar_results:
            return self.scalar_results.pop(0)
        return self.next_instance

    def add(self, entity):
        self.added.append(entity)

    def flush(self):
        for entity in self.added:
            if getattr(entity, "id", None) is None:
                entity.id = uuid4()
        return None

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def refresh(self, entity):
        return None


def make_transition_context():
    template_id = uuid4()
    version_id = uuid4()
    interaction_id = uuid4()
    performer = User(
        id=uuid4(),
        keycloak_user_id=uuid4(),
        username="kam",
        full_name="KAM",
        email="kam@example.local",
        role="KAM",
        is_active=True,
        roles=[Role(id=uuid4(), name="KAM", description="KAM role")],
    )
    current_stage = WorkflowStage(
        id=uuid4(),
        workflow_template_id=template_id,
        workflow_version_id=version_id,
        name="Current",
        order_index=1,
        is_active=True,
    )
    next_stage = WorkflowStage(
        id=uuid4(),
        workflow_template_id=template_id,
        workflow_version_id=version_id,
        name="Next",
        order_index=2,
        is_active=True,
    )
    current_instance = WorkflowStageInstance(
        id=uuid4(),
        interaction_id=interaction_id,
        workflow_stage_id=current_stage.id,
        status="IN_PROGRESS",
    )
    next_instance = WorkflowStageInstance(
        id=uuid4(),
        interaction_id=interaction_id,
        workflow_stage_id=next_stage.id,
        status="NOT_STARTED",
    )
    interaction = UniversityInteraction(
        id=interaction_id,
        university_id=uuid4(),
        program_id=uuid4(),
        product_id=uuid4(),
        manager_user_id=performer.id,
        workflow_template_id=template_id,
        workflow_version_id=version_id,
        current_stage_instance_id=current_instance.id,
        status="ACTIVE",
    )
    transition = WorkflowTransition(
        id=uuid4(),
        workflow_template_id=template_id,
        workflow_version_id=version_id,
        from_stage_id=current_stage.id,
        to_stage_id=next_stage.id,
    )
    db = FakeDb(
        interaction=interaction,
        current_instance=current_instance,
        next_instance=next_instance,
        current_stage=current_stage,
        next_stage=next_stage,
        performer=performer,
    )
    return db, interaction, current_instance, next_instance, transition, performer


def override_db(db: FakeDb):
    def dependency():
        yield db

    return dependency


def test_transition_service_commits_stage_history_and_audit_atomically() -> None:
    db, interaction, current_instance, next_instance, transition, performer = make_transition_context()
    service = TransitionService(db)
    service.transition_repository = FakeTransitionRepository(transition)

    result = service.execute_transition(
        interaction.id,
        WorkflowTransitionExecute(transition_id=transition.id, performed_by=performer.id, comment="done"),
        request_id="req-1",
    )

    history = next(entity for entity in db.added if isinstance(entity, WorkflowTransitionHistory))
    audit = next(entity for entity in db.added if isinstance(entity, AuditEvent))
    assert current_instance.status == "COMPLETED"
    assert next_instance.status == "IN_PROGRESS"
    assert interaction.current_stage_instance_id == next_instance.id
    assert result.transition_history_id == history.id
    assert audit.action == "workflow.transition"
    assert audit.request_id == "req-1"
    assert audit.event_metadata["transition_history_id"] == str(history.id)
    assert db.committed is True
    assert db.rolled_back is False


def test_transition_service_illegal_transition_returns_conflict() -> None:
    db, interaction, _current_instance, _next_instance, transition, performer = make_transition_context()
    service = TransitionService(db)
    service.transition_repository = FakeTransitionRepository(None)

    with pytest.raises(HTTPException) as error:
        service.execute_transition(
            interaction.id,
            WorkflowTransitionExecute(transition_id=transition.id, performed_by=performer.id),
        )

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "WORKFLOW_TRANSITION_NOT_ALLOWED"
    assert db.committed is False


def test_transition_service_rolls_back_when_audit_fails() -> None:
    db, interaction, _current_instance, _next_instance, transition, performer = make_transition_context()
    service = TransitionService(db)
    service.transition_repository = FakeTransitionRepository(transition)
    service.audit_repository = FailingAuditRepository()

    with pytest.raises(RuntimeError, match="audit failed"):
        service.execute_transition(
            interaction.id,
            WorkflowTransitionExecute(transition_id=transition.id, performed_by=performer.id),
        )

    assert db.committed is False
    assert db.rolled_back is True


def test_transition_endpoint_uses_authenticated_user_and_writes_audit() -> None:
    db, interaction, _current_instance, _next_instance, transition, performer = make_transition_context()
    db.scalar_results = [transition, db.next_instance]
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: performer
    app.dependency_overrides[get_db_session] = override_db(db)
    client = TestClient(app)

    response = client.post(
        f"/api/workflows/interactions/{interaction.id}/transition",
        json={"transition_id": str(transition.id), "comment": "via api"},
        headers={"X-Request-ID": "api-req-1"},
    )

    audit = next(entity for entity in db.added if isinstance(entity, AuditEvent))
    assert response.status_code == 200
    assert response.json()["current_stage_instance_id"] == str(db.next_instance.id)
    assert audit.actor_user_id == performer.id
    assert audit.request_id == "api-req-1"
    assert db.committed is True


def test_transition_endpoint_returns_stable_domain_error_envelope() -> None:
    db, interaction, _current_instance, _next_instance, transition, performer = make_transition_context()
    db.scalar_results = [None]
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: performer
    app.dependency_overrides[get_db_session] = override_db(db)
    client = TestClient(app)

    response = client.post(
        f"/api/workflows/interactions/{interaction.id}/transition",
        json={"transition_id": str(transition.id)},
    )

    body = response.json()
    assert response.status_code == 409
    assert body["code"] == "WORKFLOW_TRANSITION_NOT_ALLOWED"
    assert body["details"]["transitionId"] == str(transition.id)
    assert db.committed is False

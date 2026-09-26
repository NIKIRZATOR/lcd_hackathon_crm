from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.database import get_db_session
from app.main import create_app
from app.modules.auth.dependencies import get_current_user
from app.modules.checklists.model import ProgramChecklistValue
from app.modules.program_instances.model import ProgramInstance
from app.modules.users.model import Role, User
from app.modules.workflows.model import WorkflowStage, WorkflowStageInstance, WorkflowTransition
from app.modules.workflows.schemas import WorkflowTransitionExecute
from app.modules.workflows.service import TransitionService


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


class RouteDb:
    def __init__(self, checklist_value: ProgramChecklistValue | None = None) -> None:
        self.checklist_value = checklist_value

    def get(self, model, entity_id):
        if model is ProgramChecklistValue:
            return self.checklist_value
        return None


def override_db(db):
    def dependency():
        yield db

    return dependency


@pytest.mark.parametrize("method", ["get", "patch"])
@pytest.mark.parametrize("role", ["KAM", "MANAGER"])
def test_checklist_endpoints_enforce_stage_scope(
    monkeypatch, method: str, role: str
) -> None:
    stage_id = uuid4()
    value = ProgramChecklistValue(
        id=uuid4(), checklist_item_id=uuid4(), stage_instance_id=stage_id, is_done=False
    )
    db = RouteDb(value)
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: make_user(role)
    app.dependency_overrides[get_db_session] = override_db(db)

    def deny(*_args, **_kwargs):
        raise HTTPException(status_code=403, detail="Cannot access this organization")

    monkeypatch.setattr(
        "app.modules.checklists.router.ensure_can_access_stage_instance", deny
    )
    client = TestClient(app)
    if method == "get":
        response = client.get(f"/api/stage-instances/{stage_id}/checklist")
    else:
        response = client.patch(
            f"/api/stage-instances/checklist/{value.id}", json={"is_done": True}
        )

    assert response.status_code == 403


def test_kam_cannot_open_management_api() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: make_user("KAM")
    app.dependency_overrides[get_db_session] = override_db(RouteDb())

    response = TestClient(app).get("/api/management/stages")

    assert response.status_code == 403


def test_kam_cannot_create_global_organization() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: make_user("KAM")
    app.dependency_overrides[get_db_session] = override_db(RouteDb())

    response = TestClient(app).post(
        "/api/organizations",
        json={"type_id": str(uuid4()), "name": "Forbidden organization"},
    )

    assert response.status_code == 403


class TransitionDb:
    def __init__(self, program, instance, stage) -> None:
        self.entities = {
            (ProgramInstance, program.id): program,
            (WorkflowStageInstance, instance.id): instance,
            (WorkflowStage, stage.id): stage,
        }
        self.added = []
        self.flushed = False
        self.committed = False
        self.scalar_results = []

    def get(self, model, entity_id, **_kwargs):
        if model is User:
            user = make_user("KAM")
            user.id = entity_id
            return user
        return self.entities.get((model, entity_id))

    def scalar(self, _statement):
        if self.scalar_results:
            return self.scalar_results.pop(0)
        return 0

    def add(self, entity):
        self.added.append(entity)

    def flush(self):
        self.flushed = True
        for entity in self.added:
            if getattr(entity, "id", None) is None:
                entity.id = uuid4()

    def commit(self):
        self.committed = True


def make_program_transition(*, is_final: bool, is_optional: bool = False):
    template_id = uuid4()
    version_id = uuid4()
    stage = WorkflowStage(
        id=uuid4(),
        workflow_template_id=template_id,
        workflow_version_id=version_id,
        name="Control" if is_final else "Mandatory",
        order_index=14 if is_final else 1,
        is_initial=not is_final,
        is_final=is_final,
        is_optional=is_optional,
        is_active=True,
        requires_comment=False,
        requires_attachment=False,
    )
    instance = WorkflowStageInstance(
        id=uuid4(),
        program_instance_id=uuid4(),
        workflow_stage_id=stage.id,
        status="IN_PROGRESS",
    )
    program = ProgramInstance(
        id=instance.program_instance_id,
        organization_id=uuid4(),
        direction_id=uuid4(),
        product_id=uuid4(),
        playbook_template_id=template_id,
        workflow_version_id=version_id,
        current_stage_instance_id=instance.id,
        template_snapshot={},
        status="active",
        health_band="green",
    )
    return program, instance, stage


def test_program_transition_rejects_skip_for_mandatory_stage() -> None:
    program, instance, stage = make_program_transition(is_final=False)
    db = TransitionDb(program, instance, stage)

    with pytest.raises(HTTPException) as error:
        TransitionService(db).execute_program_transition(
            program,
            WorkflowTransitionExecute(
                transition_id=uuid4(), performed_by=uuid4(), skip_current=True
            ),
        )

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "WORKFLOW_STAGE_NOT_OPTIONAL"
    assert db.committed is False


def test_program_transition_allows_skip_for_optional_stage() -> None:
    program, instance, stage = make_program_transition(
        is_final=False, is_optional=True
    )
    next_stage = WorkflowStage(
        id=uuid4(),
        workflow_template_id=program.playbook_template_id,
        workflow_version_id=program.workflow_version_id,
        name="Next",
        order_index=2,
        is_initial=False,
        is_final=False,
        is_optional=False,
        is_active=True,
        requires_comment=False,
        requires_attachment=False,
    )
    next_instance = WorkflowStageInstance(
        id=uuid4(),
        program_instance_id=program.id,
        workflow_stage_id=next_stage.id,
        status="NOT_STARTED",
    )
    transition = WorkflowTransition(
        id=uuid4(),
        workflow_template_id=program.playbook_template_id,
        workflow_version_id=program.workflow_version_id,
        from_stage_id=stage.id,
        to_stage_id=next_stage.id,
    )
    db = TransitionDb(program, instance, stage)
    db.entities[(WorkflowStage, next_stage.id)] = next_stage
    db.entities[(WorkflowStageInstance, next_instance.id)] = next_instance
    db.scalar_results = [0, next_instance]
    service = TransitionService(db)

    class TransitionRepository:
        def get_allowed_transition(self, **_kwargs):
            return transition

    service.transition_repository = TransitionRepository()
    result = service.execute_program_transition(
        program,
        WorkflowTransitionExecute(
            transition_id=transition.id, performed_by=uuid4(), skip_current=True
        ),
    )

    assert instance.status == "SKIPPED"
    assert next_instance.status == "IN_PROGRESS"
    assert result["current_stage_instance_id"] == str(next_instance.id)
    assert db.committed is False


def test_final_stage_completes_program_without_phantom_transition() -> None:
    program, instance, stage = make_program_transition(is_final=True)
    db = TransitionDb(program, instance, stage)

    result = TransitionService(db).execute_program_transition(
        program,
        WorkflowTransitionExecute(performed_by=uuid4(), comment="complete"),
    )

    assert instance.status == "COMPLETED"
    assert program.status == "completed"
    assert program.completed_at is not None
    assert program.current_stage_instance_id is None
    assert program.current_stage_code is None
    assert result["current_stage_instance_id"] is None
    assert db.flushed is True
    assert db.committed is False

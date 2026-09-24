from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.modules.health.service import HealthService
from app.modules.integrations.model import ProgramMetric
from app.modules.licenses.model import License
from app.modules.program_instances.model import ProgramInstance
from app.modules.teachers.model import TeacherCarrier
from app.modules.workflows.model import WorkflowStageInstance


class _Rows:
    def __init__(self, values):
        self.values = values

    def all(self):
        return self.values


class FakeDb:
    def __init__(self, program, stage=None, licenses=None, teacher=None):
        self.entities = {
            (ProgramInstance, program.id): program,
        }
        if stage is not None:
            self.entities[(WorkflowStageInstance, stage.id)] = stage
        self.licenses = licenses or []
        self.teacher = teacher
        self.committed = False

    def get(self, model, entity_id):
        return self.entities.get((model, entity_id))

    def scalars(self, _statement):
        return _Rows(self.licenses)

    def scalar(self, _statement):
        if _statement.column_descriptions[0].get("entity") is ProgramMetric:
            return None
        return self.teacher

    def commit(self):
        self.committed = True

    def refresh(self, _entity):
        return None


def make_program(stage_id=None):
    return ProgramInstance(
        id=uuid4(),
        current_stage_instance_id=stage_id,
        health_band="green",
    )


def test_health_is_yellow_without_license_and_teacher() -> None:
    program = make_program()

    result = HealthService(FakeDb(program)).recompute(program.id)

    assert result.health_score == 70
    assert result.health_band == "yellow"


def test_healthy_license_and_teacher_make_program_green() -> None:
    program = make_program()
    license_record = License(
        valid_until=datetime.now(timezone.utc) + timedelta(days=365),
        transfer_status="transferred",
    )
    teacher = TeacherCarrier(
        status="active",
        qualification_until=datetime.now(timezone.utc).date() + timedelta(days=365),
        last_lms_activity_on=datetime.now(timezone.utc).date(),
    )

    result = HealthService(FakeDb(program, licenses=[license_record], teacher=teacher)).recompute(program.id)

    assert result.health_score == 100
    assert result.health_band == "green"


def test_overdue_stage_makes_health_red() -> None:
    stage = WorkflowStageInstance(id=uuid4(), due_at=datetime.now(timezone.utc) - timedelta(days=1))
    program = make_program(stage.id)

    result = HealthService(FakeDb(program, stage)).recompute(program.id)

    assert result.health_score == 45
    assert result.health_band == "red"

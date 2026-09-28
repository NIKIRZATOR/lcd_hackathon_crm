from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.modules.checklists.model import ProgramChecklistValue
from app.modules.checklists.router import ChecklistUpdate
from app.modules.interactions.model import UniversityInteraction
from app.modules.program_instances.schemas import ProgramInstanceStart
from app.modules.program_instances.service import ProgramInstanceService
from app.modules.workflows.model import WorkflowTemplate
from scripts.seed_demo_data import SHORT_PLAYBOOKS, _sync_legacy_interaction_stages


def test_playbook_applicability_keeps_full_cycle_out_of_school() -> None:
    full_cycle = WorkflowTemplate(code="full_cycle", name="Full", applies_to_type="all")
    school_short = WorkflowTemplate(code="school_short", name="School", applies_to_type="school")

    assert ProgramInstanceService._template_applies(full_cycle, "university")
    assert ProgramInstanceService._template_applies(full_cycle, "spo")
    assert not ProgramInstanceService._template_applies(full_cycle, "school")
    assert ProgramInstanceService._template_applies(school_short, "school")
    assert not ProgramInstanceService._template_applies(school_short, "university")


def test_canonical_short_playbooks_are_complete() -> None:
    assert set(SHORT_PLAYBOOKS) == {
        "expansion",
        "license_renewal",
        "teacher_replace",
        "school_short",
    }
    assert SHORT_PLAYBOOKS["teacher_replace"] == [
        "find_teacher",
        "train_teacher",
        "confirm_teacher",
        "handover_course",
    ]
    assert SHORT_PLAYBOOKS["license_renewal"][0] == "sign_license"
    assert SHORT_PLAYBOOKS["school_short"][-1] == "period_results"


def test_program_start_accepts_explicit_kam_override() -> None:
    kam_id = uuid4()
    payload = ProgramInstanceStart(
        direction_id=uuid4(),
        product_id=uuid4(),
        playbook_template_id=uuid4(),
        kam_user_id=kam_id,
    )
    assert payload.kam_user_id == kam_id


def test_typed_checklist_schema_and_model_fields() -> None:
    stakeholder_id = uuid4()
    attachment_id = uuid4()
    payload = ChecklistUpdate(
        is_done=True,
        value_number=Decimal("12.5"),
        value_date=date(2026, 9, 25),
        stakeholder_id=stakeholder_id,
        attachment_id=attachment_id,
    )

    assert payload.value_number == Decimal("12.5")
    assert payload.value_date == date(2026, 9, 25)
    assert payload.stakeholder_id == stakeholder_id
    assert payload.attachment_id == attachment_id
    assert {"value_number", "value_date", "stakeholder_id", "attachment_id"} <= set(
        ProgramChecklistValue.__table__.columns.keys()
    )


def test_legacy_interaction_stage_state_follows_program_stage() -> None:
    program_stages = [
        SimpleNamespace(
            id="program-contact",
            status="COMPLETED",
            started_at="contact-started",
            due_at="contact-due",
            completed_at="contact-completed",
            skipped_at=None,
        ),
        SimpleNamespace(
            id="program-need",
            status="IN_PROGRESS",
            started_at="need-started",
            due_at="need-due",
            completed_at=None,
            skipped_at=None,
        ),
    ]
    interaction_stages = [
        SimpleNamespace(id="interaction-contact"),
        SimpleNamespace(id="interaction-need"),
    ]
    interaction = SimpleNamespace(
        id="legacy-interaction",
        current_stage_instance_id=interaction_stages[0].id,
    )

    class Result:
        def __init__(self, rows):
            self.rows = rows

        def all(self):
            return self.rows

    class FakeSession:
        def __init__(self):
            self.results = [
                [
                    (program_stages[0], SimpleNamespace(), "find_contact"),
                    (program_stages[1], SimpleNamespace(), "identify_need"),
                ],
                [
                    (interaction_stages[0], "find_contact"),
                    (interaction_stages[1], "identify_need"),
                ],
            ]

        def get(self, model, identity):
            if model is UniversityInteraction and identity == interaction.id:
                return interaction
            return None

        def execute(self, _statement):
            return Result(self.results.pop(0))

    program = SimpleNamespace(
        id="program",
        legacy_interaction_id=interaction.id,
        current_stage_instance_id=program_stages[1].id,
    )

    _sync_legacy_interaction_stages(FakeSession(), program)

    assert interaction.current_stage_instance_id == interaction_stages[1].id
    assert interaction_stages[0].status == "COMPLETED"
    assert interaction_stages[0].completed_at == "contact-completed"
    assert interaction_stages[1].status == "IN_PROGRESS"
    assert interaction_stages[1].due_at == "need-due"

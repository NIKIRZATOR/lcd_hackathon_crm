from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.modules.checklists.model import ProgramChecklistValue
from app.modules.checklists.router import ChecklistUpdate
from app.modules.program_instances.schemas import ProgramInstanceStart
from app.modules.program_instances.service import ProgramInstanceService
from app.modules.workflows.model import WorkflowTemplate
from scripts.seed_demo_data import SHORT_PLAYBOOKS


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

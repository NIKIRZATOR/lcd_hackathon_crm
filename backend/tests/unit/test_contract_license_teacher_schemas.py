from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.licenses.schemas import ContractCreate, LicenseCreate
from app.modules.teachers.schemas import TeacherCarrierCreate, TeacherCarrierUpdate


def test_license_accepts_v2_program_link() -> None:
    recipient_id = uuid4()
    payload = LicenseCreate(
        program_instance_id=uuid4(),
        transfer_status="in_progress",
        recipient_stakeholder_id=recipient_id,
    )

    assert payload.transfer_status == "in_progress"
    assert payload.recipient_stakeholder_id == recipient_id


def test_contract_accepts_signer() -> None:
    assert ContractCreate(number="C-1", signer="Authorized person").signer == "Authorized person"


def test_license_rejects_unknown_transfer_status() -> None:
    with pytest.raises(ValidationError):
        LicenseCreate(program_instance_id=uuid4(), transfer_status="unknown")


def test_teacher_carrier_has_valid_lifecycle_status() -> None:
    payload = TeacherCarrierCreate(product_id=uuid4(), full_name="Demo Teacher", status="active")

    assert payload.status == "active"


def test_teacher_update_is_partial() -> None:
    assert TeacherCarrierUpdate(status="left").status == "left"

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.licenses.schemas import LicenseCreate
from app.modules.teachers.schemas import TeacherCarrierCreate, TeacherCarrierUpdate


def test_license_accepts_v2_program_link() -> None:
    payload = LicenseCreate(program_instance_id=uuid4(), transfer_status="in_progress")

    assert payload.transfer_status == "in_progress"


def test_license_rejects_unknown_transfer_status() -> None:
    with pytest.raises(ValidationError):
        LicenseCreate(program_instance_id=uuid4(), transfer_status="unknown")


def test_teacher_carrier_has_valid_lifecycle_status() -> None:
    payload = TeacherCarrierCreate(product_id=uuid4(), full_name="Demo Teacher", status="active")

    assert payload.status == "active"


def test_teacher_update_is_partial() -> None:
    assert TeacherCarrierUpdate(status="left").status == "left"

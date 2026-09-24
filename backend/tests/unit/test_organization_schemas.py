from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.organizations.schemas import OrganizationCreate, StakeholderCreate
from app.modules.organizations.model import Organization
from app.modules.organizations.service import OrganizationService
from app.modules.users.model import Role, User


def test_organization_create_accepts_core_fields() -> None:
    payload = OrganizationCreate(type_id=uuid4(), name="Demo university", kam_user_id=uuid4())

    assert payload.name == "Demo university"


def test_stakeholder_rejects_unknown_role() -> None:
    with pytest.raises(ValidationError):
        StakeholderCreate(full_name="Demo contact", role_code="unknown")


def test_kam_cannot_read_unassigned_organization() -> None:
    organization = Organization(id=uuid4(), type_id=uuid4(), name="Restricted")
    user = User(id=uuid4(), full_name="KAM", role="KAM", roles=[Role(name="KAM")])

    class FakeDb:
        def get(self, model, entity_id):
            return organization

        def scalar(self, statement):
            return False

    with pytest.raises(Exception) as exc_info:
        OrganizationService(FakeDb()).get(organization.id, user)  # type: ignore[arg-type]

    assert getattr(exc_info.value, "status_code", None) == 403

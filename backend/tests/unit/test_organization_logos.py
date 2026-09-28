from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.main import create_app
from app.modules.documents.model import File
from app.modules.organizations.model import Organization
from app.modules.organizations.schemas import OrganizationRead, StakeholderCreate
from app.modules.organizations.service import OrganizationService
from app.modules.users.model import Role, User
from scripts.seed_demo_data import ORGANIZATION_LOGO_FILES, UNIVERSITIES


class FakeDb:
    def __init__(self, organization: Organization, file_record: File | None = None) -> None:
        self.organization = organization
        self.file_record = file_record

    def get(self, model, entity_id):
        if model is Organization and entity_id == self.organization.id:
            return self.organization
        if model is File and self.file_record is not None and entity_id == self.file_record.id:
            return self.file_record
        return None


def admin_user() -> User:
    return User(id=uuid4(), full_name="Admin", role="ADMIN", roles=[Role(name="ADMIN")])


def test_preload_logo_mapping_covers_seeded_universities() -> None:
    assert set(ORGANIZATION_LOGO_FILES) == {item["short_name"] for item in UNIVERSITIES}
    assert len(set(ORGANIZATION_LOGO_FILES.values())) == len(ORGANIZATION_LOGO_FILES)


def test_logo_file_returns_active_organization_logo() -> None:
    logo = File(
        id=uuid4(),
        original_name="logo.png",
        storage_name="logo.png",
        storage_path="organization-logos/logo.png",
        bucket="organization-logos",
        object_key="logo.png",
        mime_type="image/png",
        attachment_kind="organization_logo",
    )
    organization = Organization(
        id=uuid4(),
        type_id=uuid4(),
        name="University",
        logo_file_id=logo.id,
    )

    assert OrganizationService(FakeDb(organization, logo)).logo_file(organization.id, admin_user()) is logo


def test_logo_file_returns_404_when_logo_is_not_configured() -> None:
    organization = Organization(id=uuid4(), type_id=uuid4(), name="University", logo_file_id=None)

    with pytest.raises(HTTPException) as error:
        OrganizationService(FakeDb(organization)).logo_file(organization.id, admin_user())

    assert error.value.status_code == 404


def test_organization_schema_preserves_logo_and_workflow_contact_fields() -> None:
    assert "logo_file_id" in OrganizationRead.model_fields
    assert StakeholderCreate(full_name="Contact", contact_source="site").contact_source == "site"


def test_logo_management_endpoints_are_exposed_in_openapi() -> None:
    operations = create_app().openapi()["paths"]["/api/organizations/{organization_id}/logo"]

    assert {"get", "post", "put", "delete"}.issubset(operations)

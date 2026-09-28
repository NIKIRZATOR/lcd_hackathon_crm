import pytest
from pydantic import ValidationError

from app.modules.documents.schemas import DocumentTemplateCreate


def test_document_template_accepts_external_source() -> None:
    payload = DocumentTemplateCreate(
        kind="curriculum_plan",
        name="Curriculum plan",
        external_url="https://example.test/template",
    )

    assert payload.external_url == "https://example.test/template"


def test_document_template_requires_source() -> None:
    with pytest.raises(ValidationError):
        DocumentTemplateCreate(kind="curriculum_plan", name="Curriculum plan")

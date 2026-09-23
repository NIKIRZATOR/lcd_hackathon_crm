import pytest
from fastapi import HTTPException

from app.modules.imports.mapping.service import MappingService
from app.modules.imports.schemas import MappingFieldPayload


class DummyDb:
    pass


def test_mapping_rejects_missing_required_target() -> None:
    service = MappingService(DummyDb())

    with pytest.raises(HTTPException) as error:
        service.validate_fields([MappingFieldPayload(source_column="Вендор", target_field="vendor.name")])

    assert error.value.detail["code"] == "IMPORT_REQUIRED_MAPPING_MISSING"


def test_mapping_rejects_duplicate_target() -> None:
    service = MappingService(DummyDb())
    fields = [
        MappingFieldPayload(source_column="A", target_field="university.name"),
        MappingFieldPayload(source_column="B", target_field="university.name"),
        MappingFieldPayload(source_column="C", target_field="vendor.name"),
        MappingFieldPayload(source_column="D", target_field="product.name"),
    ]

    with pytest.raises(HTTPException) as error:
        service.validate_fields(fields)

    assert error.value.detail["code"] == "IMPORT_MAPPING_INVALID"


def test_mapping_accepts_required_targets() -> None:
    service = MappingService(DummyDb())

    service.validate_fields(
        [
            MappingFieldPayload(source_column="Название ВУЗа", target_field="university.name"),
            MappingFieldPayload(source_column="Вендор", target_field="vendor.name"),
            MappingFieldPayload(source_column="ПО", target_field="product.name"),
        ]
    )

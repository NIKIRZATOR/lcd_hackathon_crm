from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.imports.mapping.presets import RTK_DEFAULT_FIELDS, RTK_DEFAULT_MAPPING_NAME
from app.modules.imports.mapping.registry import REQUIRED_TARGETS, TARGET_FIELD_BY_KEY
from app.modules.imports.model import ImportMapping, ImportMappingField
from app.modules.imports.schemas import MappingFieldPayload


def import_error(code: str, message: str, status_code: int = 400, details: dict | None = None) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message, "details": details})


class MappingService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def ensure_system_presets(self) -> None:
        mapping = self.db.scalar(select(ImportMapping).where(ImportMapping.name == RTK_DEFAULT_MAPPING_NAME))
        if mapping is not None:
            return
        mapping = ImportMapping(name=RTK_DEFAULT_MAPPING_NAME, is_system=True, created_by=None)
        self.db.add(mapping)
        self.db.flush()
        for field in RTK_DEFAULT_FIELDS:
            self.db.add(ImportMappingField(mapping_id=mapping.id, **field))
        self.db.commit()

    def list_mappings(self) -> list[ImportMapping]:
        self.ensure_system_presets()
        return list(self.db.scalars(select(ImportMapping).order_by(ImportMapping.is_system.desc(), ImportMapping.name)).all())

    def get_mapping(self, mapping_id: UUID) -> ImportMapping:
        mapping = self.db.get(ImportMapping, mapping_id)
        if mapping is None:
            raise import_error("IMPORT_MAPPING_NOT_FOUND", "Import mapping not found", 404)
        return mapping

    def get_mapping_fields(self, mapping_id: UUID) -> list[ImportMappingField]:
        return list(
            self.db.scalars(
                select(ImportMappingField)
                .where(ImportMappingField.mapping_id == mapping_id)
                .order_by(ImportMappingField.created_at)
            ).all()
        )

    def create_mapping(self, *, name: str, fields: list[MappingFieldPayload], created_by: UUID) -> ImportMapping:
        self.validate_fields(fields)
        mapping = ImportMapping(name=name, is_system=False, created_by=created_by)
        self.db.add(mapping)
        self.db.flush()
        for field in fields:
            self.db.add(ImportMappingField(mapping_id=mapping.id, **field.model_dump()))
        self.db.commit()
        self.db.refresh(mapping)
        return mapping

    def update_mapping_fields(self, *, mapping_id: UUID, fields: list[MappingFieldPayload]) -> None:
        mapping = self.get_mapping(mapping_id)
        if mapping.is_system:
            raise import_error("IMPORT_MAPPING_INVALID", "System mapping cannot be edited in place")
        self.validate_fields(fields)
        self.db.execute(delete(ImportMappingField).where(ImportMappingField.mapping_id == mapping_id))
        for field in fields:
            self.db.add(ImportMappingField(mapping_id=mapping_id, **field.model_dump()))
        self.db.flush()

    def snapshot_from_mapping(self, mapping_id: UUID) -> dict:
        mapping = self.get_mapping(mapping_id)
        fields = self.get_mapping_fields(mapping_id)
        return {
            "mapping_id": str(mapping.id),
            "name": mapping.name,
            "fields": [
                {
                    "source_column": field.source_column,
                    "target_field": field.target_field,
                    "required": field.required,
                    "transformer": field.transformer,
                }
                for field in fields
            ],
        }

    def snapshot_from_payload(self, fields: list[MappingFieldPayload]) -> dict:
        self.validate_fields(fields)
        return {"mapping_id": None, "name": "JOB_CUSTOM", "fields": [field.model_dump() for field in fields]}

    def validate_fields(self, fields: list[MappingFieldPayload]) -> None:
        if not fields:
            raise import_error("IMPORT_MAPPING_INVALID", "Mapping must contain at least one field")
        source_columns = [field.source_column.strip() for field in fields]
        target_fields = [field.target_field.strip() for field in fields]
        unknown = [target for target in target_fields if target not in TARGET_FIELD_BY_KEY]
        if unknown:
            raise import_error("IMPORT_MAPPING_INVALID", "Mapping contains unknown target fields", details={"unknown": unknown})
        if len(source_columns) != len(set(source_columns)):
            raise import_error("IMPORT_MAPPING_INVALID", "Mapping contains duplicate source columns")
        if len(target_fields) != len(set(target_fields)):
            raise import_error("IMPORT_MAPPING_INVALID", "Mapping contains duplicate target fields")
        missing_required = sorted(REQUIRED_TARGETS - set(target_fields))
        if missing_required:
            raise import_error(
                "IMPORT_REQUIRED_MAPPING_MISSING",
                "Mapping misses required target fields",
                details={"missing": missing_required},
            )

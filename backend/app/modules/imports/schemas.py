from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TargetFieldRead(BaseModel):
    key: str
    label: str
    type: str
    required: bool
    entity: str


class ImportJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    source_file_id: UUID | None
    created_by: UUID
    sheet_name: str | None
    header_row: int
    mapping_id: UUID | None
    total_rows: int
    valid_rows: int
    invalid_rows: int
    create_count: int
    update_count: int
    skip_count: int
    conflict_count: int
    validated_at: datetime | None
    confirmed_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None
    error_code: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    source_file_name: str | None = None
    created_by_name: str | None = None


class ImportPreviewRead(BaseModel):
    job_id: UUID = Field(alias="jobId")
    sheet_names: list[str] = Field(alias="sheetNames")
    sheet: str
    headers: list[str]
    rows: list[list[object | None]]
    total_rows: int = Field(alias="totalRows")
    file_type: str = Field(alias="fileType")


class MappingFieldPayload(BaseModel):
    source_column: str = Field(min_length=1)
    target_field: str = Field(min_length=1)
    required: bool = False
    transformer: str | None = None


class ImportMappingCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    fields: list[MappingFieldPayload]


class ImportMappingFieldRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_column: str
    target_field: str
    required: bool
    transformer: str | None


class ImportMappingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    is_system: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
    fields: list[ImportMappingFieldRead] = []


class JobMappingUpdate(BaseModel):
    mapping_id: UUID | None = None
    fields: list[MappingFieldPayload] | None = None


class ImportJobConfigUpdate(BaseModel):
    sheet_name: str | None = None
    header_row: int = Field(default=1, ge=1)


class JobMappingRead(BaseModel):
    job_id: UUID
    mapping_id: UUID | None
    fields: list[MappingFieldPayload]


class ImportValidateRead(BaseModel):
    job_id: UUID
    status: str
    total_rows: int
    valid_rows: int
    invalid_rows: int


class ImportRowErrorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    row_number: int = Field(alias="row")
    column_name: str | None = Field(alias="column")
    target_field: str | None = Field(alias="targetField")
    error_code: str = Field(alias="code")
    message: str
    raw_fragment: str | None = Field(alias="rawFragment")


class ImportDiffItem(BaseModel):
    row: int
    action: str
    entity: str = "interaction"
    business_key: str = Field(alias="businessKey")
    reasons: list[str] = []
    payload: dict[str, object | None] = {}


class ImportDiffRead(BaseModel):
    job_id: UUID
    status: str
    create_count: int
    update_count: int
    skip_count: int
    conflict_count: int
    items: list[ImportDiffItem]


class ImportConfirmRead(BaseModel):
    job_id: UUID
    status: str
    create_count: int
    update_count: int
    skip_count: int
    conflict_count: int

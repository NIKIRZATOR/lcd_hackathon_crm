from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class ProgramMetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    program_instance_id: UUID
    applications_count: int
    students_count: int
    streams_count: int
    payment_records_count: int
    teacher_activity_on: date | None
    synced_at: datetime | None
    last_website_signal_at: datetime | None
    last_payment_signal_at: datetime | None
    last_lms_signal_at: datetime | None

    @field_validator("payment_records_count", mode="before")
    @classmethod
    def default_payment_records_count(cls, value):
        return 0 if value is None else value


class SyncResultRead(BaseModel):
    mapped: int
    unmatched: int
    errors: int
    metrics: ProgramMetricRead


class FixtureProcessRead(BaseModel):
    processed: int
    mapped: int
    unmatched: int
    errors: int
    ignored: int


class CourseMappingCreate(BaseModel):
    source: str = "PAYMENT"
    external_course_name: str
    direction_id: UUID | None = None
    product_id: UUID | None = None


class StreamMappingCreate(BaseModel):
    source: str = "PAYMENT"
    external_course_name: str
    external_stream_id: str
    program_instance_id: UUID


class ReplayRequest(BaseModel):
    source: str = "PAYMENT"
    external_course_name: str
    external_stream_id: str


class MappingApplyRequest(BaseModel):
    source: str = "PAYMENT"
    external_course_name: str
    external_stream_id: str
    program_instance_id: UUID

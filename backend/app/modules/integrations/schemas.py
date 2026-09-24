from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProgramMetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    program_instance_id: UUID
    applications_count: int
    students_count: int
    streams_count: int
    teacher_activity_on: date | None
    synced_at: datetime | None


class SyncResultRead(BaseModel):
    mapped: int
    unmatched: int
    errors: int
    metrics: ProgramMetricRead

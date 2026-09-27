from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AcademicWindowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    title: str
    plan_cutoff_on: date
    classes_start_on: date
    classes_end_on: date
    is_current: bool


class ProgramInstanceRead(BaseModel):
    id: UUID
    organization_id: UUID
    direction_id: UUID
    direction_name: str
    product_id: UUID
    product_name: str
    kam_user_id: UUID | None
    kam_name: str | None
    playbook_template_id: UUID
    playbook_name: str
    playbook_code: str | None
    status: str
    current_stage_code: str | None
    academic_window_id: UUID | None
    academic_window_title: str | None
    health_score: int | None
    health_band: str
    started_at: datetime | None
    completed_at: datetime | None
    comment: str | None
    legacy_interaction_id: UUID | None = None


class OrganizationHealthRead(BaseModel):
    organization_id: UUID
    active_programs_count: int
    worst_health_score: int | None
    worst_health_band: str | None
    worst_program_instance_id: UUID | None


class WorkflowJournalRead(BaseModel):
    id: UUID
    organization_name: str
    direction_name: str
    product_name: str
    playbook_name: str
    current_stage_name: str | None
    due_at: datetime | None
    health_score: int | None
    health_band: str
    kam_name: str | None
    students_count: int | None
    applications_count: int | None
    payment_records_count: int | None
    streams_count: int | None
    last_b2c_signal_at: datetime | None
    status: str
    academic_window_title: str | None


class ProgramInstanceStart(BaseModel):
    direction_id: UUID
    product_id: UUID
    playbook_template_id: UUID
    kam_user_id: UUID | None = None
    academic_window_id: UUID | None = None
    comment: str | None = None
    parent_program_id: UUID | None = None

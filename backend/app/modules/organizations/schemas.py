from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrganizationTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    name: str
    is_active: bool


class OrganizationCreate(BaseModel):
    type_id: UUID
    name: str = Field(min_length=1, max_length=255)
    short_name: str | None = None
    region: str | None = None
    city: str | None = None
    comment: str | None = None
    kam_user_id: UUID | None = None


class OrganizationUpdate(BaseModel):
    type_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    short_name: str | None = None
    region: str | None = None
    city: str | None = None
    status: str | None = Field(default=None, pattern="^(active|paused|archived)$")
    comment: str | None = None


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    type_id: UUID
    name: str
    short_name: str | None
    region: str | None
    city: str | None
    status: str
    comment: str | None
    created_at: datetime
    updated_at: datetime


class OrganizationListRead(OrganizationRead):
    type_name: str
    kam_name: str | None
    active_programs_count: int
    worst_health_score: int | None
    worst_health_band: str | None
    nearest_risk: str | None
    no_activity: bool


class Organization360Read(BaseModel):
    id: UUID
    type_name: str
    kam_name: str | None
    documents_count: int
    feed_events_count: int


class OrganizationDocumentRead(BaseModel):
    file_id: UUID
    attachment_id: UUID | None = None
    filename: str
    kind: str | None = None
    program_name: str | None = None
    stage_name: str | None = None
    created_at: datetime
    uploaded_by_name: str | None = None


class OrganizationFeedItemRead(BaseModel):
    id: str
    kind: str
    title: str
    description: str | None = None
    created_at: datetime
    actor_name: str | None = None


class KamRead(BaseModel):
    id: UUID
    full_name: str


class AssignmentCreate(BaseModel):
    kam_user_id: UUID
    reason: str | None = Field(default=None, max_length=1000)


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    user_id: UUID
    status: str
    assigned_at: datetime
    assigned_by: UUID
    ended_at: datetime | None


class AssignmentHistoryRead(AssignmentRead):
    kam_name: str
    assigned_by_name: str | None


class StakeholderCreate(BaseModel):
    role_code: str = Field(default="other", pattern="^(vice_rector|dean|methodist|lawyer|chair|teacher|director|school_teacher|other)$")
    full_name: str = Field(min_length=1, max_length=255)
    position: str | None = None
    email: str | None = None
    phone: str | None = None
    contact_source: str | None = Field(default=None, pattern="^(university_card|call|email|site|event|referral|other)$")
    is_primary: bool = False
    comment: str | None = None
    program_instance_id: UUID | None = None


class StakeholderUpdate(BaseModel):
    role_code: str | None = Field(default=None, pattern="^(vice_rector|dean|methodist|lawyer|chair|teacher|director|school_teacher|other)$")
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    position: str | None = None
    email: str | None = None
    phone: str | None = None
    contact_source: str | None = Field(default=None, pattern="^(university_card|call|email|site|event|referral|other)$")
    is_primary: bool | None = None
    is_active: bool | None = None
    comment: str | None = None
    program_instance_id: UUID | None = None


class StakeholderRead(StakeholderCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    program_instance_id: UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

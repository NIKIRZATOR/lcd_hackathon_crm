from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UniversityInteractionBase(BaseModel):
    university_id: UUID
    program_id: UUID
    product_id: UUID
    manager_user_id: UUID
    workflow_template_id: UUID
    status: str = "ACTIVE"
    started_at: datetime | None = None
    completed_at: datetime | None = None
    comment: str | None = None


class UniversityInteractionCreate(UniversityInteractionBase):
    pass


class UniversityInteractionUpdate(BaseModel):
    university_id: UUID | None = None
    program_id: UUID | None = None
    product_id: UUID | None = None
    manager_user_id: UUID | None = None
    workflow_template_id: UUID | None = None
    current_stage_instance_id: UUID | None = None
    status: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    comment: str | None = None


class UniversityInteractionRead(UniversityInteractionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    current_stage_instance_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

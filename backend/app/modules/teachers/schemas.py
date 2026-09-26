from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TeacherCarrierCreate(BaseModel):
    product_id: UUID
    program_instance_id: UUID | None = None
    stakeholder_id: UUID | None = None
    full_name: str
    trained_on: date | None = None
    qualification_until: date | None = None
    last_lms_activity_on: date | None = None
    status: Literal["planned", "trained", "active", "expired", "left"] = "planned"


class TeacherCarrierUpdate(BaseModel):
    product_id: UUID | None = None
    program_instance_id: UUID | None = None
    stakeholder_id: UUID | None = None
    full_name: str | None = None
    trained_on: date | None = None
    qualification_until: date | None = None
    last_lms_activity_on: date | None = None
    status: Literal["planned", "trained", "active", "expired", "left"] | None = None


class TeacherCarrierRead(TeacherCarrierCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    product_name: str

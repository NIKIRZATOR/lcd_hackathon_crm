from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UniversityContactBase(BaseModel):
    university_id: UUID
    full_name: str
    position: str | None = None
    email: str | None = None
    phone: str | None = None
    department: str | None = None
    is_primary: bool = False
    is_active: bool = True
    comment: str | None = None


class UniversityContactCreate(UniversityContactBase):
    pass


class UniversityContactUpdate(BaseModel):
    university_id: UUID | None = None
    full_name: str | None = None
    position: str | None = None
    email: str | None = None
    phone: str | None = None
    department: str | None = None
    is_primary: bool | None = None
    is_active: bool | None = None
    comment: str | None = None


class UniversityContactRead(UniversityContactBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime

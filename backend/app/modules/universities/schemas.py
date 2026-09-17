from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UniversityBase(BaseModel):
    name: str
    short_name: str | None = None
    region: str | None = None
    city: str | None = None
    address: str | None = None
    website: str | None = None
    is_active: bool = True


class UniversityCreate(UniversityBase):
    pass


class UniversityUpdate(BaseModel):
    name: str | None = None
    short_name: str | None = None
    region: str | None = None
    city: str | None = None
    address: str | None = None
    website: str | None = None
    is_active: bool | None = None


class UniversityRead(UniversityBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime

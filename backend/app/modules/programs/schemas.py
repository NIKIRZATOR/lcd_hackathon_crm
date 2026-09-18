from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ITDirectionBase(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None
    is_active: bool = True


class ITDirectionCreate(ITDirectionBase):
    pass


class ITDirectionUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    description: str | None = None
    is_active: bool | None = None


class ITDirectionRead(ITDirectionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class ITProgramBase(BaseModel):
    direction_id: UUID
    name: str
    description: str | None = None
    version: str | None = None
    is_active: bool = True


class ITProgramCreate(ITProgramBase):
    pass


class ITProgramUpdate(BaseModel):
    direction_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    version: str | None = None
    is_active: bool | None = None


class ITProgramRead(ITProgramBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime

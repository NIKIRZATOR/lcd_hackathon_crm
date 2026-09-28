from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class VendorBase(BaseModel):
    name: str
    description: str | None = None
    is_active: bool = True


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class VendorRead(VendorBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class VendorContactBase(BaseModel):
    product_id: UUID | None = None
    business_key: str
    full_name: str
    phone: str | None = None
    email: str | None = None
    preferred_channel: str | None = None


class VendorContactCreate(VendorContactBase):
    pass


class VendorContactUpdate(BaseModel):
    product_id: UUID | None = None
    business_key: str | None = None
    full_name: str | None = None
    phone: str | None = None
    email: str | None = None
    preferred_channel: str | None = None


class VendorContactRead(VendorContactBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    created_at: datetime
    updated_at: datetime


class ITProductBase(BaseModel):
    vendor_id: UUID | None = None
    name: str
    description: str | None = None
    documentation_url: str | None = None
    is_active: bool = True


class ITProductCreate(ITProductBase):
    pass


class ITProductUpdate(BaseModel):
    vendor_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    documentation_url: str | None = None
    is_active: bool | None = None


class ITProductRead(ITProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class ProgramProductBase(BaseModel):
    program_id: UUID
    product_id: UUID
    is_required: bool = True


class ProgramProductCreate(ProgramProductBase):
    pass


class ProgramProductUpdate(BaseModel):
    is_required: bool | None = None


class ProgramProductRead(ProgramProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime

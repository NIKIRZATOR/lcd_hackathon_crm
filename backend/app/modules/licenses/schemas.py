from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ContractCreate(BaseModel):
    number: str
    signed_on: date | None = None
    valid_until: datetime | None = None
    status: str | None = None
    attachment_id: UUID | None = None
    comment: str | None = None


class ContractUpdate(BaseModel):
    number: str | None = None
    signed_on: date | None = None
    valid_until: datetime | None = None
    status: str | None = None
    attachment_id: UUID | None = None
    comment: str | None = None


class ContractRead(ContractCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID | None


class LicenseCreate(BaseModel):
    program_instance_id: UUID
    contract_id: UUID | None = None
    license_number: str | None = None
    signed_at: datetime | None = None
    valid_until: datetime | None = None
    transfer_status: Literal["not_transferred", "in_progress", "transferred", "revoked"] = "not_transferred"
    product_access: str | None = None
    transferred_on: date | None = None
    attachment_id: UUID | None = None
    comment: str | None = None


class LicenseUpdate(BaseModel):
    contract_id: UUID | None = None
    license_number: str | None = None
    signed_at: datetime | None = None
    valid_until: datetime | None = None
    transfer_status: Literal["not_transferred", "in_progress", "transferred", "revoked"] | None = None
    product_access: str | None = None
    transferred_on: date | None = None
    attachment_id: UUID | None = None
    comment: str | None = None


class LicenseRead(LicenseCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    product_name: str

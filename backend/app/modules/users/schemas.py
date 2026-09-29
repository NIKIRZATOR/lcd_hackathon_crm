from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ManagerMembershipCreate(BaseModel):
    manager_user_id: UUID = Field(description="MANAGER user identifier.")
    kam_user_id: UUID = Field(description="Subordinate KAM user identifier.")
    valid_from: datetime | None = Field(default=None, description="Optional assignment validity start.")
    valid_to: datetime | None = Field(default=None, description="Optional assignment validity end.")


class ManagerMembershipUpdate(BaseModel):
    valid_from: datetime | None = Field(default=None, description="Optional assignment validity start.")
    valid_to: datetime | None = Field(default=None, description="Optional assignment validity end.")
    is_active: bool | None = Field(default=None, description="Whether this manager-to-KAM relation is active.")


class ManagerMembershipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(description="Manager membership identifier.")
    manager_user_id: UUID = Field(description="MANAGER user identifier.")
    kam_user_id: UUID = Field(description="Subordinate KAM user identifier.")
    valid_from: datetime | None = Field(default=None, description="Optional assignment validity start.")
    valid_to: datetime | None = Field(default=None, description="Optional assignment validity end.")
    is_active: bool = Field(description="Whether this manager-to-KAM relation is active.")
    created_at: datetime = Field(description="Creation timestamp.")
    updated_at: datetime = Field(description="Last update timestamp.")


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    keycloak_user_id: UUID | None
    username: str | None
    full_name: str
    email: str | None
    roles: list[str]
    is_active: bool
    has_avatar: bool
    created_at: datetime
    updated_at: datetime


class UserStatusUpdate(BaseModel):
    is_active: bool

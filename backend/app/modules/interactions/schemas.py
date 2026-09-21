from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UniversityInteractionBase(BaseModel):
    university_id: UUID = Field(description="University identifier.")
    program_id: UUID = Field(description="IT program identifier.")
    product_id: UUID = Field(description="IT product identifier.")
    manager_user_id: UUID | None = Field(default=None, description="Current responsible KAM user identifier.")
    workflow_template_id: UUID = Field(description="Workflow template used to initialize runtime stages.")
    status: str = Field(default="ACTIVE", description="Interaction business status.")
    contract_number: str | None = Field(default=None, description="Contract number from customer/source data.")
    license_signed: bool = Field(default=False, description="Whether the license has been signed.")
    license_signed_at: datetime | None = Field(default=None, description="License signing date and time.")
    license_valid_until: datetime | None = Field(default=None, description="License validity end date and time.")
    transfer_status: str | None = Field(default=None, description="Product/material transfer status.")
    university_responsibles: str | None = Field(default=None, description="Responsible people on university side.")
    started_at: datetime | None = Field(default=None, description="Interaction start date and time.")
    completed_at: datetime | None = Field(default=None, description="Interaction completion date and time.")
    comment: str | None = Field(default=None, description="Free-form interaction comment.")


class UniversityInteractionCreate(UniversityInteractionBase):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "university_id": "11111111-1111-1111-1111-111111111111",
                    "program_id": "22222222-2222-2222-2222-222222222222",
                    "product_id": "33333333-3333-3333-3333-333333333333",
                    "manager_user_id": "44444444-4444-4444-4444-444444444444",
                    "workflow_template_id": "55555555-5555-5555-5555-555555555555",
                    "status": "ACTIVE",
                    "contract_number": "RTK-DEMO-001",
                    "license_signed": True,
                    "license_signed_at": "2026-09-21T09:00:00Z",
                    "license_valid_until": "2027-09-21T09:00:00Z",
                    "transfer_status": "TRANSFERRED",
                    "university_responsibles": "Ivan Sokolov, Head of Department",
                    "comment": "Initial interaction imported from demo catalog.",
                }
            ]
        }
    )


class UniversityInteractionUpdate(BaseModel):
    university_id: UUID | None = None
    program_id: UUID | None = None
    product_id: UUID | None = None
    manager_user_id: UUID | None = None
    workflow_template_id: UUID | None = None
    current_stage_instance_id: UUID | None = None
    status: str | None = None
    contract_number: str | None = None
    license_signed: bool | None = None
    license_signed_at: datetime | None = None
    license_valid_until: datetime | None = None
    transfer_status: str | None = None
    university_responsibles: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    comment: str | None = None


class UniversityInteractionAssign(BaseModel):
    manager_user_id: UUID | None = Field(
        default=None,
        description="New responsible KAM user identifier. Use null to remove the current assignee.",
    )
    reason: str | None = Field(default=None, description="Human-readable reason for assignment change.")

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "manager_user_id": "44444444-4444-4444-4444-444444444444",
                    "reason": "Reassigned by manager after university scope review.",
                },
                {
                    "manager_user_id": None,
                    "reason": "Temporarily unassigned before redistribution.",
                },
            ]
        }
    )


class UniversityInteractionRead(UniversityInteractionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    current_stage_instance_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class ResponsibleAssignmentHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    interaction_id: UUID
    old_manager_user_id: UUID | None
    new_manager_user_id: UUID | None
    changed_by_user_id: UUID
    reason: str | None
    changed_at: datetime
    created_at: datetime
    updated_at: datetime

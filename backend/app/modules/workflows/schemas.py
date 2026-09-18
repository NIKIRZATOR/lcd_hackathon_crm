from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

StageStatus = Literal["NOT_STARTED", "IN_PROGRESS", "WAITING", "BLOCKED", "COMPLETED", "SKIPPED"]


class WorkflowTemplateBase(BaseModel):
    name: str
    description: str | None = None
    version: str | None = None
    is_active: bool = True
    is_default: bool = False
    created_by: UUID | None = None


class WorkflowTemplateCreate(WorkflowTemplateBase):
    pass


class WorkflowTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    version: str | None = None
    is_active: bool | None = None
    is_default: bool | None = None
    created_by: UUID | None = None


class WorkflowTemplateRead(WorkflowTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class WorkflowStageBase(BaseModel):
    workflow_template_id: UUID
    name: str
    description: str | None = None
    order_index: int
    is_initial: bool = False
    is_final: bool = False
    is_optional: bool = False
    default_duration_days: int | None = None
    requires_comment: bool = False
    requires_attachment: bool = False
    is_active: bool = True


class WorkflowStageCreate(WorkflowStageBase):
    pass


class WorkflowStageUpdate(BaseModel):
    workflow_template_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    order_index: int | None = None
    is_initial: bool | None = None
    is_final: bool | None = None
    is_optional: bool | None = None
    default_duration_days: int | None = None
    requires_comment: bool | None = None
    requires_attachment: bool | None = None
    is_active: bool | None = None


class WorkflowStageRead(WorkflowStageBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class WorkflowTransitionBase(BaseModel):
    workflow_template_id: UUID
    from_stage_id: UUID
    to_stage_id: UUID
    name: str | None = None
    is_default: bool = False
    condition_code: str | None = None


class WorkflowTransitionCreate(WorkflowTransitionBase):
    pass


class WorkflowTransitionUpdate(BaseModel):
    workflow_template_id: UUID | None = None
    from_stage_id: UUID | None = None
    to_stage_id: UUID | None = None
    name: str | None = None
    is_default: bool | None = None
    condition_code: str | None = None


class WorkflowTransitionRead(WorkflowTransitionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class WorkflowStageInstanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    interaction_id: UUID
    workflow_stage_id: UUID
    responsible_user_id: UUID | None = None
    status: StageStatus
    started_at: datetime | None = None
    due_at: datetime | None = None
    completed_at: datetime | None = None
    skipped_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class WorkflowStageInstanceStatusUpdate(BaseModel):
    status: StageStatus


class WorkflowTransitionHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    interaction_id: UUID
    from_stage_instance_id: UUID | None = None
    to_stage_instance_id: UUID | None = None
    transition_id: UUID | None = None
    performed_by: UUID
    comment: str | None = None
    performed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class WorkflowTransitionExecute(BaseModel):
    transition_id: UUID
    performed_by: UUID
    comment: str | None = None
    skip_current: bool = False


class WorkflowTransitionResult(BaseModel):
    interaction_id: UUID
    from_stage_instance_id: UUID
    to_stage_instance_id: UUID
    transition_history_id: UUID
    current_stage_instance_id: UUID

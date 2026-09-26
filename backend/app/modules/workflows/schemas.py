from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

StageStatus = Literal["NOT_STARTED", "IN_PROGRESS", "WAITING", "BLOCKED", "COMPLETED", "SKIPPED"]
WorkflowVersionStatus = Literal["DRAFT", "PUBLISHED", "ARCHIVED"]
WorkflowTransitionKind = Literal["FORWARD", "BACKWARD", "OPTIONAL", "BRANCH"]
WorkflowChangeSeverity = Literal["LOW", "MEDIUM", "HIGH"]
WorkflowChangeRequestStatus = Literal["PENDING", "APPROVED", "REJECTED", "CANCELLED"]
WorkflowMigrationJobStatus = Literal["PENDING", "RUNNING", "COMPLETED", "FAILED"]


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


class WorkflowVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workflow_template_id: UUID
    version: int
    status: WorkflowVersionStatus
    supersedes_version_id: UUID | None = None
    created_by: UUID | None = None
    published_at: datetime | None = None
    archived_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class WorkflowStageBase(BaseModel):
    workflow_template_id: UUID
    workflow_version_id: UUID | None = None
    name: str
    description: str | None = None
    order_index: int
    is_initial: bool = False
    is_final: bool = False
    is_optional: bool = False
    semester_critical: bool = False
    default_duration_days: int | None = None
    requires_comment: bool = False
    requires_attachment: bool = False
    is_active: bool = True


class WorkflowStageCreate(WorkflowStageBase):
    pass


class WorkflowStageUpdate(BaseModel):
    workflow_template_id: UUID | None = None
    workflow_version_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    order_index: int | None = None
    is_initial: bool | None = None
    is_final: bool | None = None
    is_optional: bool | None = None
    semester_critical: bool | None = None
    default_duration_days: int | None = None
    requires_comment: bool | None = None
    requires_attachment: bool | None = None
    is_active: bool | None = None


class WorkflowStageRead(WorkflowStageBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class WorkflowChecklistItemBase(BaseModel):
    code: str
    label: str
    item_type: Literal["checkbox", "file", "date", "stakeholder_role", "number", "text"]
    required: bool = True
    required_stakeholder_role: str | None = None
    required_attachment_kind: str | None = None


class WorkflowChecklistItemCreate(WorkflowChecklistItemBase):
    pass


class WorkflowChecklistItemUpdate(BaseModel):
    code: str | None = None
    label: str | None = None
    item_type: Literal["checkbox", "file", "date", "stakeholder_role", "number", "text"] | None = None
    required: bool | None = None
    required_stakeholder_role: str | None = None
    required_attachment_kind: str | None = None


class WorkflowChecklistItemRead(WorkflowChecklistItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class WorkflowTransitionBase(BaseModel):
    workflow_template_id: UUID
    workflow_version_id: UUID | None = None
    from_stage_id: UUID
    to_stage_id: UUID
    name: str | None = None
    is_default: bool = False
    condition_code: str | None = None


class WorkflowTransitionCreate(WorkflowTransitionBase):
    pass


class WorkflowTransitionUpdate(BaseModel):
    workflow_template_id: UUID | None = None
    workflow_version_id: UUID | None = None
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


class WorkflowDangerousChangeRead(BaseModel):
    change_type: str
    severity: WorkflowChangeSeverity
    stage_name: str | None = None
    from_stage_name: str | None = None
    to_stage_name: str | None = None
    message: str
    details: dict | None = None


class WorkflowDangerousChangesRead(BaseModel):
    workflow_version_id: UUID
    supersedes_version_id: UUID | None = None
    active_interaction_count: int = 0
    has_dangerous_changes: bool
    changes: list[WorkflowDangerousChangeRead]


class WorkflowChangeRequestCreate(BaseModel):
    reason: str | None = None


class WorkflowChangeRequestReview(BaseModel):
    review_comment: str | None = None


class WorkflowChangeRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workflow_version_id: UUID
    status: WorkflowChangeRequestStatus
    requested_by: UUID
    reviewed_by: UUID | None = None
    requested_at: datetime | None = None
    reviewed_at: datetime | None = None
    reason: str | None = None
    review_comment: str | None = None
    dangerous_changes_snapshot: dict | None = None
    created_at: datetime
    updated_at: datetime


class WorkflowStageMappingItem(BaseModel):
    source_stage_id: UUID
    target_stage_id: UUID


class WorkflowMigrationPreviewRequest(BaseModel):
    mappings: list[WorkflowStageMappingItem] = []


class WorkflowStageMappingRead(BaseModel):
    source_stage_id: UUID
    source_stage_name: str
    target_stage_id: UUID
    target_stage_name: str


class WorkflowMigrationPreviewRead(BaseModel):
    source_version_id: UUID
    target_version_id: UUID
    affected_interaction_count: int
    can_migrate: bool
    missing_stage_mappings: list[UUID]
    stage_mappings: list[WorkflowStageMappingRead]


class WorkflowMigrationExecuteRequest(WorkflowMigrationPreviewRequest):
    change_request_id: UUID | None = None


class WorkflowMigrationJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_version_id: UUID
    target_version_id: UUID
    change_request_id: UUID | None = None
    status: WorkflowMigrationJobStatus
    created_by: UUID | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    affected_interaction_count: int
    migrated_interaction_count: int
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class WorkflowAvailableTransitionRead(WorkflowTransitionRead):
    transition_kind: WorkflowTransitionKind
    to_stage: WorkflowStageRead


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


class WorkflowStageCommentCreate(BaseModel):
    text: str


class WorkflowStageCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    stage_instance_id: UUID
    author_user_id: UUID
    text: str
    created_at: datetime


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
    transition_id: UUID | None = None
    performed_by: UUID | None = None
    comment: str | None = None
    skip_current: bool = False
    expected_current_stage_instance_id: UUID | None = None


class WorkflowTransitionResult(BaseModel):
    interaction_id: UUID
    from_stage_instance_id: UUID
    to_stage_instance_id: UUID
    transition_history_id: UUID
    current_stage_instance_id: UUID

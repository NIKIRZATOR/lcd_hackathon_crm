from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.common.errors import get_request_id
from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import ADMIN_ROLES, CRM_ROLES, ensure_can_read_interaction, forbidden, is_admin
from app.modules.auth.dependencies import require_roles
from app.modules.interactions.model import UniversityInteraction
from app.modules.users.model import User
from app.modules.workflows.model import WorkflowStageInstance
from app.modules.workflows.schemas import (
    WorkflowAvailableTransitionRead,
    WorkflowChangeRequestCreate,
    WorkflowChangeRequestRead,
    WorkflowChangeRequestReview,
    WorkflowDangerousChangesRead,
    WorkflowMigrationExecuteRequest,
    WorkflowMigrationJobRead,
    WorkflowMigrationPreviewRead,
    WorkflowMigrationPreviewRequest,
    WorkflowStageCreate,
    WorkflowStageInstanceRead,
    WorkflowStageInstanceStatusUpdate,
    WorkflowStageRead,
    WorkflowStageUpdate,
    WorkflowTemplateCreate,
    WorkflowTemplateRead,
    WorkflowTemplateUpdate,
    WorkflowTransitionCreate,
    WorkflowTransitionExecute,
    WorkflowTransitionHistoryRead,
    WorkflowTransitionRead,
    WorkflowTransitionResult,
    WorkflowTransitionUpdate,
    WorkflowVersionRead,
)
from app.modules.workflows.service import (
    WorkflowRuntimeService,
    WorkflowStageService,
    WorkflowTemplateService,
    WorkflowTransitionService,
    WorkflowVersionService,
)

router = APIRouter(
    prefix="/workflows",
    tags=["workflows"],
    dependencies=[Depends(require_roles(*CRM_ROLES))],
)


def _ensure_can_access_interaction(db: Session, current_user: User, interaction_id: UUID) -> UniversityInteraction:
    interaction = db.get(UniversityInteraction, interaction_id)
    if interaction is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University interaction not found")
    ensure_can_read_interaction(db, current_user, interaction)
    return interaction


@router.get("/templates", response_model=Page[WorkflowTemplateRead])
def list_templates(
    search: str | None = None,
    is_active: bool | None = None,
    is_default: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = WorkflowTemplateService(db).list_templates(
        search=search,
        is_active=is_active,
        is_default=is_default,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/templates/{template_id}", response_model=WorkflowTemplateRead)
def get_template(template_id: UUID, db: Session = Depends(get_db_session)):
    return WorkflowTemplateService(db).get_template(template_id)


@router.post("/templates", response_model=WorkflowTemplateRead, status_code=201)
def create_template(
    payload: WorkflowTemplateCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowTemplateService(db).create_template(payload)


@router.patch("/templates/{template_id}", response_model=WorkflowTemplateRead)
def update_template(
    template_id: UUID,
    payload: WorkflowTemplateUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowTemplateService(db).update_template(template_id, payload)


@router.get("/templates/{template_id}/versions", response_model=list[WorkflowVersionRead])
def list_template_versions(template_id: UUID, db: Session = Depends(get_db_session)):
    return WorkflowVersionService(db).list_versions(template_id)


@router.get("/change-requests", response_model=Page[WorkflowChangeRequestRead])
def list_workflow_change_requests(
    workflow_version_id: UUID | None = None,
    status: str | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    result = WorkflowVersionService(db).list_change_requests(
        workflow_version_id=workflow_version_id,
        status_value=status,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/change-requests/{change_request_id}", response_model=WorkflowChangeRequestRead)
def get_workflow_change_request(
    change_request_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).get_change_request(change_request_id)


@router.post("/templates/{template_id}/versions/draft", response_model=WorkflowVersionRead, status_code=201)
def create_template_draft(
    template_id: UUID,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).create_draft(
        template_id,
        created_by=current_user.id,
        request_id=get_request_id(request),
    )


@router.post("/versions/{version_id}/change-request", response_model=WorkflowChangeRequestRead, status_code=201)
def create_workflow_change_request(
    version_id: UUID,
    payload: WorkflowChangeRequestCreate,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).create_change_request(
        version_id,
        payload,
        requested_by=current_user.id,
        request_id=get_request_id(request),
    )


@router.post("/change-requests/{change_request_id}/approve", response_model=WorkflowChangeRequestRead)
def approve_workflow_change_request(
    change_request_id: UUID,
    payload: WorkflowChangeRequestReview,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).approve_change_request(
        change_request_id,
        payload,
        reviewed_by=current_user.id,
        request_id=get_request_id(request),
    )


@router.post("/change-requests/{change_request_id}/reject", response_model=WorkflowChangeRequestRead)
def reject_workflow_change_request(
    change_request_id: UUID,
    payload: WorkflowChangeRequestReview,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).reject_change_request(
        change_request_id,
        payload,
        reviewed_by=current_user.id,
        request_id=get_request_id(request),
    )


@router.post("/versions/{version_id}/publish", response_model=WorkflowVersionRead)
def publish_workflow_version(
    version_id: UUID,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).publish_version(
        version_id,
        actor_user_id=current_user.id,
        request_id=get_request_id(request),
    )


@router.get("/versions/{version_id}/dangerous-changes", response_model=WorkflowDangerousChangesRead)
def get_workflow_version_dangerous_changes(
    version_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).detect_dangerous_changes(version_id)


@router.post("/versions/{version_id}/migration/preview", response_model=WorkflowMigrationPreviewRead)
def preview_workflow_migration(
    version_id: UUID,
    payload: WorkflowMigrationPreviewRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).preview_migration(version_id, payload)


@router.post("/versions/{version_id}/migration/execute", response_model=WorkflowMigrationJobRead)
def execute_workflow_migration(
    version_id: UUID,
    payload: WorkflowMigrationExecuteRequest,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).execute_migration(
        version_id,
        payload,
        created_by=current_user.id,
        request_id=get_request_id(request),
    )


@router.get("/stages", response_model=Page[WorkflowStageRead])
def list_stages(
    workflow_template_id: UUID | None = None,
    workflow_version_id: UUID | None = None,
    is_active: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = WorkflowStageService(db).list_stages(
        workflow_template_id=workflow_template_id,
        workflow_version_id=workflow_version_id,
        is_active=is_active,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/stages/{stage_id}", response_model=WorkflowStageRead)
def get_stage(stage_id: UUID, db: Session = Depends(get_db_session)):
    return WorkflowStageService(db).get_stage(stage_id)


@router.post("/stages", response_model=WorkflowStageRead, status_code=201)
def create_stage(
    payload: WorkflowStageCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowStageService(db).create_stage(payload)


@router.patch("/stages/{stage_id}", response_model=WorkflowStageRead)
def update_stage(
    stage_id: UUID,
    payload: WorkflowStageUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowStageService(db).update_stage(stage_id, payload)


@router.get("/transitions", response_model=Page[WorkflowTransitionRead])
def list_transitions(
    workflow_template_id: UUID | None = None,
    workflow_version_id: UUID | None = None,
    from_stage_id: UUID | None = None,
    to_stage_id: UUID | None = None,
    is_default: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = WorkflowTransitionService(db).list_transitions(
        workflow_template_id=workflow_template_id,
        workflow_version_id=workflow_version_id,
        from_stage_id=from_stage_id,
        to_stage_id=to_stage_id,
        is_default=is_default,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/transitions/{transition_id}", response_model=WorkflowTransitionRead)
def get_transition(transition_id: UUID, db: Session = Depends(get_db_session)):
    return WorkflowTransitionService(db).get_transition(transition_id)


@router.post("/transitions", response_model=WorkflowTransitionRead, status_code=201)
def create_transition(
    payload: WorkflowTransitionCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowTransitionService(db).create_transition(payload)


@router.patch("/transitions/{transition_id}", response_model=WorkflowTransitionRead)
def update_transition(
    transition_id: UUID,
    payload: WorkflowTransitionUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowTransitionService(db).update_transition(transition_id, payload)


@router.get("/stage-instances", response_model=Page[WorkflowStageInstanceRead])
def list_stage_instances(
    interaction_id: UUID | None = None,
    status: str | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    if interaction_id is None and not is_admin(current_user):
        raise forbidden("interaction_id is required for this role")
    if interaction_id is not None:
        _ensure_can_access_interaction(db, current_user, interaction_id)
    result = WorkflowRuntimeService(db).list_stage_instances(
        interaction_id=interaction_id,
        status_value=status,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/interactions/{interaction_id}/current-stage", response_model=WorkflowStageInstanceRead)
def get_current_stage_instance(
    interaction_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    _ensure_can_access_interaction(db, current_user, interaction_id)
    return WorkflowRuntimeService(db).get_current_stage_instance(interaction_id)


@router.get("/interactions/{interaction_id}/available-transitions", response_model=list[WorkflowAvailableTransitionRead])
def list_available_transitions(
    interaction_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    _ensure_can_access_interaction(db, current_user, interaction_id)
    return WorkflowRuntimeService(db).list_available_transitions(interaction_id)


@router.patch("/stage-instances/{stage_instance_id}/status", response_model=WorkflowStageInstanceRead)
def update_stage_instance_status(
    stage_instance_id: UUID,
    payload: WorkflowStageInstanceStatusUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    instance = db.get(WorkflowStageInstance, stage_instance_id)
    if instance is not None:
        _ensure_can_access_interaction(db, current_user, instance.interaction_id)
    return WorkflowRuntimeService(db).update_stage_instance_status(stage_instance_id, payload)


@router.get("/transition-history", response_model=Page[WorkflowTransitionHistoryRead])
def list_transition_history(
    interaction_id: UUID | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    if interaction_id is None and not is_admin(current_user):
        raise forbidden("interaction_id is required for this role")
    if interaction_id is not None:
        _ensure_can_access_interaction(db, current_user, interaction_id)
    result = WorkflowRuntimeService(db).list_transition_history(
        interaction_id=interaction_id,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.post("/interactions/{interaction_id}/transition", response_model=WorkflowTransitionResult)
def execute_transition(
    interaction_id: UUID,
    payload: WorkflowTransitionExecute,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    _ensure_can_access_interaction(db, current_user, interaction_id)
    scoped_payload = payload.model_copy(update={"performed_by": current_user.id})
    return WorkflowRuntimeService(db).execute_transition(
        interaction_id,
        scoped_payload,
        request_id=get_request_id(request),
    )

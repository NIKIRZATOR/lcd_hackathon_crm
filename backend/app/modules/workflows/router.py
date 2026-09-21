from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import ADMIN_ROLES, CRM_ROLES, can_access_all_interactions, ensure_can_read_interaction, forbidden
from app.modules.auth.dependencies import require_roles
from app.modules.interactions.model import UniversityInteraction
from app.modules.users.model import User
from app.modules.workflows.model import WorkflowStageInstance
from app.modules.workflows.schemas import (
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
)
from app.modules.workflows.service import (
    WorkflowRuntimeService,
    WorkflowStageService,
    WorkflowTemplateService,
    WorkflowTransitionService,
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
    ensure_can_read_interaction(current_user, interaction)
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


@router.get("/stages", response_model=Page[WorkflowStageRead])
def list_stages(
    workflow_template_id: UUID | None = None,
    is_active: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = WorkflowStageService(db).list_stages(
        workflow_template_id=workflow_template_id,
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
    from_stage_id: UUID | None = None,
    to_stage_id: UUID | None = None,
    is_default: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = WorkflowTransitionService(db).list_transitions(
        workflow_template_id=workflow_template_id,
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
    if interaction_id is None and not can_access_all_interactions(current_user):
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
    if interaction_id is None and not can_access_all_interactions(current_user):
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
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    _ensure_can_access_interaction(db, current_user, interaction_id)
    scoped_payload = payload.model_copy(update={"performed_by": current_user.id})
    return WorkflowRuntimeService(db).execute_transition(interaction_id, scoped_payload)

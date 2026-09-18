from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
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

router = APIRouter(prefix="/workflows", tags=["workflows"])


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
def create_template(payload: WorkflowTemplateCreate, db: Session = Depends(get_db_session)):
    return WorkflowTemplateService(db).create_template(payload)


@router.patch("/templates/{template_id}", response_model=WorkflowTemplateRead)
def update_template(
    template_id: UUID,
    payload: WorkflowTemplateUpdate,
    db: Session = Depends(get_db_session),
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
def create_stage(payload: WorkflowStageCreate, db: Session = Depends(get_db_session)):
    return WorkflowStageService(db).create_stage(payload)


@router.patch("/stages/{stage_id}", response_model=WorkflowStageRead)
def update_stage(stage_id: UUID, payload: WorkflowStageUpdate, db: Session = Depends(get_db_session)):
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
def create_transition(payload: WorkflowTransitionCreate, db: Session = Depends(get_db_session)):
    return WorkflowTransitionService(db).create_transition(payload)


@router.patch("/transitions/{transition_id}", response_model=WorkflowTransitionRead)
def update_transition(
    transition_id: UUID,
    payload: WorkflowTransitionUpdate,
    db: Session = Depends(get_db_session),
):
    return WorkflowTransitionService(db).update_transition(transition_id, payload)


@router.get("/stage-instances", response_model=Page[WorkflowStageInstanceRead])
def list_stage_instances(
    interaction_id: UUID | None = None,
    status: str | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
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
def get_current_stage_instance(interaction_id: UUID, db: Session = Depends(get_db_session)):
    return WorkflowRuntimeService(db).get_current_stage_instance(interaction_id)


@router.patch("/stage-instances/{stage_instance_id}/status", response_model=WorkflowStageInstanceRead)
def update_stage_instance_status(
    stage_instance_id: UUID,
    payload: WorkflowStageInstanceStatusUpdate,
    db: Session = Depends(get_db_session),
):
    return WorkflowRuntimeService(db).update_stage_instance_status(stage_instance_id, payload)


@router.get("/transition-history", response_model=Page[WorkflowTransitionHistoryRead])
def list_transition_history(
    interaction_id: UUID | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
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
):
    return WorkflowRuntimeService(db).execute_transition(interaction_id, payload)

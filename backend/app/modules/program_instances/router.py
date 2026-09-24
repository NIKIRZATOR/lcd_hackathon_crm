from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.checklists.model import PlaybookChecklistItem, ProgramChecklistValue
from app.modules.interactions.model import UniversityInteraction
from app.modules.program_instances.model import AcademicWindow, ProgramInstance
from app.modules.program_instances.schemas import AcademicWindowRead, ProgramInstanceRead, ProgramInstanceStart
from app.modules.program_instances.service import ProgramInstanceService
from app.modules.users.model import User
from app.modules.workflows.model import WorkflowStageInstance

router = APIRouter(tags=["program_instances"], dependencies=[Depends(require_roles(*CRM_ROLES))])


@router.get("/academic-windows", response_model=list[AcademicWindowRead])
def list_academic_windows(db: Session = Depends(get_db_session)):
    return list(db.scalars(select(AcademicWindow).order_by(AcademicWindow.classes_start_on)).all())


@router.get("/organizations/{organization_id}/program-instances", response_model=Page[ProgramInstanceRead])
def list_program_instances(
    organization_id: UUID,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    result = ProgramInstanceService(db).list_for_organization(organization_id, current_user, pagination.limit, pagination.offset)
    return Page(items=result[0], total=result[1], limit=pagination.limit, offset=pagination.offset)


@router.get("/program-instances/{program_instance_id}", response_model=ProgramInstanceRead)
def get_program_instance(
    program_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    return ProgramInstanceService(db).get(program_instance_id, current_user)


@router.get("/program-instances/{program_instance_id}/checklist")
def get_program_instance_checklist(
    program_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    program = ProgramInstanceService(db).get(program_instance_id, current_user)
    if program.legacy_interaction_id is None:
        return []
    interaction = db.get(UniversityInteraction, program.legacy_interaction_id)
    if interaction is None or interaction.current_stage_instance_id is None:
        return []
    stage_instance = db.get(WorkflowStageInstance, interaction.current_stage_instance_id)
    if stage_instance is None:
        raise HTTPException(status_code=404, detail="Current workflow stage not found")
    rows = db.execute(
        select(ProgramChecklistValue, PlaybookChecklistItem)
        .join(PlaybookChecklistItem, PlaybookChecklistItem.id == ProgramChecklistValue.checklist_item_id)
        .where(ProgramChecklistValue.stage_instance_id == stage_instance.id)
    ).all()
    return [
        {"id": str(value.id), "label": item.label, "item_type": item.item_type, "required": item.required,
         "is_done": value.is_done, "value_text": value.value_text}
        for value, item in rows
    ]

@router.post("/organizations/{organization_id}/program-instances", response_model=ProgramInstanceRead, status_code=201)
def start_program_instance(organization_id: UUID, payload: ProgramInstanceStart, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return ProgramInstanceService(db).start(organization_id, payload, current_user)

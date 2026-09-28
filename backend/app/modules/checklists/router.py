from uuid import UUID
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.checklists.model import PlaybookChecklistItem, ProgramChecklistValue
from app.modules.organizations.model import Stakeholder
from app.modules.documents.model import File
from app.modules.interactions.model import UniversityInteraction
from app.modules.program_instances.model import ProgramInstance
from app.modules.workflows.model import WorkflowStageAttachment, WorkflowStageInstance
from app.modules.users.model import User
from app.modules.workflows.access import ensure_can_access_stage_instance

router = APIRouter(prefix="/stage-instances", tags=["checklists"], dependencies=[Depends(require_roles(*CRM_ROLES))])

MIN_TEXT_LENGTHS = {
    "meeting_protocol": 40,
}


class ChecklistUpdate(BaseModel):
    is_done: bool
    value_text: str | None = None
    value_number: Decimal | None = None
    value_date: date | None = None
    stakeholder_id: UUID | None = None
    attachment_id: UUID | None = None


def checklist_read(value: ProgramChecklistValue, item: PlaybookChecklistItem) -> dict:
    return {
        "id": str(value.id),
        "label": item.label,
        "item_type": item.item_type,
        "required": item.required,
        "required_stakeholder_role": item.required_stakeholder_role,
        "required_attachment_kind": item.required_attachment_kind,
        "is_done": value.is_done,
        "value_text": value.value_text,
        "value_number": value.value_number,
        "value_date": value.value_date,
        "stakeholder_id": value.stakeholder_id,
        "attachment_id": value.attachment_id,
    }


@router.get("/{stage_instance_id}/checklist")
def list_checklist(
    stage_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    ensure_can_access_stage_instance(db, current_user, stage_instance_id)
    rows = db.execute(
        select(ProgramChecklistValue, PlaybookChecklistItem)
        .join(
            PlaybookChecklistItem,
            PlaybookChecklistItem.id == ProgramChecklistValue.checklist_item_id,
        )
        .where(ProgramChecklistValue.stage_instance_id == stage_instance_id)
    ).all()
    return [checklist_read(value, item) for value, item in rows]


@router.patch("/checklist/{value_id}")
def update_checklist(
    value_id: UUID,
    payload: ChecklistUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    value = db.get(ProgramChecklistValue, value_id)
    if value is None:
        raise HTTPException(status_code=404, detail="Checklist value not found")
    ensure_can_access_stage_instance(db, current_user, value.stage_instance_id)
    item = db.get(PlaybookChecklistItem, value.checklist_item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Checklist definition not found")
    supplied = {
        "checkbox": payload.is_done,
        "text": bool(payload.value_text and payload.value_text.strip()),
        "number": payload.value_number is not None,
        "date": payload.value_date is not None,
        "stakeholder_role": payload.stakeholder_id is not None,
        "file": payload.attachment_id is not None,
    }[item.item_type]
    if payload.is_done and not supplied:
        raise HTTPException(
            status_code=422,
            detail={"code": "CHECKLIST_VALUE_REQUIRED", "message": f"Value for {item.item_type} checklist item is required"},
        )
    minimum_length = MIN_TEXT_LENGTHS.get(item.code)
    if minimum_length and payload.value_text and len(payload.value_text.strip()) < minimum_length:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "CHECKLIST_TEXT_TOO_SHORT",
                "message": f"Checklist item requires at least {minimum_length} characters",
            },
        )
    if payload.stakeholder_id is not None:
        stakeholder = db.get(Stakeholder, payload.stakeholder_id)
        stage_instance = db.get(WorkflowStageInstance, value.stage_instance_id)
        if stakeholder is None or stage_instance is None:
            raise HTTPException(status_code=422, detail="Stakeholder not found")
        if stage_instance.program_instance_id is not None:
            program = db.get(ProgramInstance, stage_instance.program_instance_id)
            owner_organization_id = program.organization_id if program is not None else None
            if stakeholder.program_instance_id not in {None, stage_instance.program_instance_id}:
                raise HTTPException(status_code=422, detail="Stakeholder belongs to another program")
        else:
            interaction = db.get(UniversityInteraction, stage_instance.interaction_id)
            owner_organization_id = interaction.university_id if interaction is not None else None
        if owner_organization_id is None or stakeholder.organization_id != owner_organization_id:
            raise HTTPException(status_code=422, detail="Stakeholder belongs to another organization")
        required_role = item.required_stakeholder_role
        if required_role and required_role != "other" and stakeholder.role_code != required_role:
            raise HTTPException(status_code=422, detail="Stakeholder role does not satisfy checklist item")
    if payload.attachment_id is not None:
        attachment = db.get(File, payload.attachment_id)
        if attachment is None or not db.scalar(
            select(WorkflowStageAttachment.id).where(
                WorkflowStageAttachment.stage_instance_id == value.stage_instance_id,
                WorkflowStageAttachment.file_id == payload.attachment_id,
            )
        ):
            raise HTTPException(status_code=422, detail="Attachment is not linked to this stage")
        if item.required_attachment_kind and attachment.attachment_kind != item.required_attachment_kind:
            raise HTTPException(status_code=422, detail={"code": "CHECKLIST_ATTACHMENT_KIND_MISMATCH", "message": "Attachment kind does not satisfy checklist item"})
    for field in ("value_text", "value_number", "value_date", "stakeholder_id", "attachment_id"):
        setattr(value, field, getattr(payload, field))
    value.is_done = payload.is_done
    db.commit()
    return checklist_read(value, item)

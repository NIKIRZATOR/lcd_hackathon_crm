from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.checklists.model import PlaybookChecklistItem, ProgramChecklistValue
from app.modules.users.model import User
from app.modules.workflows.access import ensure_can_access_stage_instance

router = APIRouter(prefix="/stage-instances", tags=["checklists"], dependencies=[Depends(require_roles(*CRM_ROLES))])


class ChecklistUpdate(BaseModel):
    is_done: bool
    value_text: str | None = None


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
    return [
        {
            "id": str(value.id),
            "label": item.label,
            "item_type": item.item_type,
            "required": item.required,
            "is_done": value.is_done,
            "value_text": value.value_text,
        }
        for value, item in rows
    ]


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
    value.is_done = payload.is_done
    value.value_text = payload.value_text
    db.commit()
    return {
        "id": str(value.id),
        "is_done": value.is_done,
        "value_text": value.value_text,
    }

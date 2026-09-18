from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.interactions.schemas import (
    UniversityInteractionCreate,
    UniversityInteractionRead,
    UniversityInteractionUpdate,
)
from app.modules.interactions.service import UniversityInteractionService

router = APIRouter(prefix="/interactions", tags=["interactions"])


@router.get("", response_model=Page[UniversityInteractionRead])
def list_interactions(
    university_id: UUID | None = None,
    program_id: UUID | None = None,
    product_id: UUID | None = None,
    manager_user_id: UUID | None = None,
    status: str | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = UniversityInteractionService(db).list_interactions(
        university_id=university_id,
        program_id=program_id,
        product_id=product_id,
        manager_user_id=manager_user_id,
        status_value=status,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/{interaction_id}", response_model=UniversityInteractionRead)
def get_interaction(interaction_id: UUID, db: Session = Depends(get_db_session)):
    return UniversityInteractionService(db).get_interaction(interaction_id)


@router.post("", response_model=UniversityInteractionRead, status_code=201)
def create_interaction(payload: UniversityInteractionCreate, db: Session = Depends(get_db_session)):
    return UniversityInteractionService(db).create_interaction(payload)


@router.patch("/{interaction_id}", response_model=UniversityInteractionRead)
def update_interaction(
    interaction_id: UUID,
    payload: UniversityInteractionUpdate,
    db: Session = Depends(get_db_session),
):
    return UniversityInteractionService(db).update_interaction(interaction_id, payload)


@router.delete("/{interaction_id}", status_code=204)
def delete_interaction(interaction_id: UUID, db: Session = Depends(get_db_session)):
    UniversityInteractionService(db).delete_interaction(interaction_id)

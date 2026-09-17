from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.contacts.schemas import (
    UniversityContactCreate,
    UniversityContactRead,
    UniversityContactUpdate,
)
from app.modules.contacts.service import UniversityContactService

router = APIRouter(prefix="/university-contacts", tags=["university_contacts"])


@router.get("", response_model=Page[UniversityContactRead])
def list_contacts(
    search: str | None = None,
    university_id: UUID | None = None,
    is_active: bool | None = None,
    is_primary: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = UniversityContactService(db).list_contacts(
        search=search,
        university_id=university_id,
        is_active=is_active,
        is_primary=is_primary,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/{contact_id}", response_model=UniversityContactRead)
def get_contact(contact_id: UUID, db: Session = Depends(get_db_session)):
    return UniversityContactService(db).get_contact(contact_id)


@router.post("", response_model=UniversityContactRead, status_code=201)
def create_contact(payload: UniversityContactCreate, db: Session = Depends(get_db_session)):
    return UniversityContactService(db).create_contact(payload)


@router.patch("/{contact_id}", response_model=UniversityContactRead)
def update_contact(
    contact_id: UUID,
    payload: UniversityContactUpdate,
    db: Session = Depends(get_db_session),
):
    return UniversityContactService(db).update_contact(contact_id, payload)


@router.patch("/{contact_id}/deactivate", response_model=UniversityContactRead)
def deactivate_contact(contact_id: UUID, db: Session = Depends(get_db_session)):
    return UniversityContactService(db).deactivate_contact(contact_id)

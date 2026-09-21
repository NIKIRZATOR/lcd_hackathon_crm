from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import (
    CATALOG_WRITE_ROLES,
    CRM_ROLES,
    ensure_can_read_contact,
    resolve_visible_manager_ids,
)
from app.modules.auth.dependencies import require_roles
from app.modules.contacts.schemas import (
    UniversityContactCreate,
    UniversityContactRead,
    UniversityContactUpdate,
)
from app.modules.contacts.service import UniversityContactService
from app.modules.users.model import User

router = APIRouter(
    prefix="/university-contacts",
    tags=["university_contacts"],
    dependencies=[Depends(require_roles(*CRM_ROLES))],
)


@router.get("", response_model=Page[UniversityContactRead])
def list_contacts(
    search: str | None = None,
    university_id: UUID | None = None,
    is_active: bool | None = None,
    is_primary: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    service = UniversityContactService(db)
    visible_manager_ids = resolve_visible_manager_ids(db, current_user)
    if visible_manager_ids is None:
        result = service.list_contacts(
            search=search,
            university_id=university_id,
            is_active=is_active,
            is_primary=is_primary,
            limit=pagination.limit,
            offset=pagination.offset,
            sort_by=pagination.sort_by,
            sort_order=pagination.sort_order,
        )
    else:
        result = service.list_contacts_for_manager(
            manager_user_id=visible_manager_ids,
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
def get_contact(
    contact_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    contact = UniversityContactService(db).get_contact(contact_id)
    ensure_can_read_contact(db, current_user, contact)
    return contact


@router.post("", response_model=UniversityContactRead, status_code=201)
def create_contact(
    payload: UniversityContactCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return UniversityContactService(db).create_contact(payload)


@router.patch("/{contact_id}", response_model=UniversityContactRead)
def update_contact(
    contact_id: UUID,
    payload: UniversityContactUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return UniversityContactService(db).update_contact(contact_id, payload)


@router.patch("/{contact_id}/deactivate", response_model=UniversityContactRead)
def deactivate_contact(
    contact_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return UniversityContactService(db).deactivate_contact(contact_id)

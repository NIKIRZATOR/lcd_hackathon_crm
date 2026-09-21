from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import (
    CATALOG_WRITE_ROLES,
    CRM_ROLES,
    ensure_can_read_university,
    resolve_visible_manager_ids,
)
from app.modules.auth.dependencies import require_roles
from app.modules.universities.schemas import UniversityCreate, UniversityRead, UniversityUpdate
from app.modules.universities.service import UniversityService
from app.modules.users.model import User

router = APIRouter(
    prefix="/universities",
    tags=["universities"],
    dependencies=[Depends(require_roles(*CRM_ROLES))],
)


@router.get("", response_model=Page[UniversityRead])
def list_universities(
    search: str | None = None,
    is_active: bool | None = None,
    region: str | None = None,
    city: str | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    service = UniversityService(db)
    visible_manager_ids = resolve_visible_manager_ids(db, current_user)
    if visible_manager_ids is None:
        result = service.list_universities(
            search=search,
            is_active=is_active,
            region=region,
            city=city,
            limit=pagination.limit,
            offset=pagination.offset,
            sort_by=pagination.sort_by,
            sort_order=pagination.sort_order,
        )
    else:
        result = service.list_universities_for_manager(
            manager_user_id=visible_manager_ids,
            search=search,
            is_active=is_active,
            region=region,
            city=city,
            limit=pagination.limit,
            offset=pagination.offset,
            sort_by=pagination.sort_by,
            sort_order=pagination.sort_order,
        )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/{university_id}", response_model=UniversityRead)
def get_university(
    university_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    university = UniversityService(db).get_university(university_id)
    ensure_can_read_university(db, current_user, university.id)
    return university


@router.post("", response_model=UniversityRead, status_code=201)
def create_university(
    payload: UniversityCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return UniversityService(db).create_university(payload)


@router.patch("/{university_id}", response_model=UniversityRead)
def update_university(
    university_id: UUID,
    payload: UniversityUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return UniversityService(db).update_university(university_id, payload)


@router.patch("/{university_id}/deactivate", response_model=UniversityRead)
def deactivate_university(
    university_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return UniversityService(db).deactivate_university(university_id)

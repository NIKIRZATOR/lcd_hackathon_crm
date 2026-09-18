from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.universities.schemas import UniversityCreate, UniversityRead, UniversityUpdate
from app.modules.universities.service import UniversityService

router = APIRouter(prefix="/universities", tags=["universities"])


@router.get("", response_model=Page[UniversityRead])
def list_universities(
    search: str | None = None,
    is_active: bool | None = None,
    region: str | None = None,
    city: str | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = UniversityService(db).list_universities(
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
def get_university(university_id: UUID, db: Session = Depends(get_db_session)):
    return UniversityService(db).get_university(university_id)


@router.post("", response_model=UniversityRead, status_code=201)
def create_university(payload: UniversityCreate, db: Session = Depends(get_db_session)):
    return UniversityService(db).create_university(payload)


@router.patch("/{university_id}", response_model=UniversityRead)
def update_university(
    university_id: UUID,
    payload: UniversityUpdate,
    db: Session = Depends(get_db_session),
):
    return UniversityService(db).update_university(university_id, payload)


@router.patch("/{university_id}/deactivate", response_model=UniversityRead)
def deactivate_university(university_id: UUID, db: Session = Depends(get_db_session)):
    return UniversityService(db).deactivate_university(university_id)

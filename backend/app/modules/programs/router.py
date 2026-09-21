from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import CATALOG_WRITE_ROLES, CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.programs.schemas import (
    ITDirectionCreate,
    ITDirectionRead,
    ITDirectionUpdate,
    ITProgramCreate,
    ITProgramRead,
    ITProgramUpdate,
)
from app.modules.programs.service import ITDirectionService, ITProgramService
from app.modules.users.model import User

router = APIRouter(tags=["programs"], dependencies=[Depends(require_roles(*CRM_ROLES))])


@router.get("/it-directions", response_model=Page[ITDirectionRead])
def list_directions(
    search: str | None = None,
    is_active: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = ITDirectionService(db).list_directions(
        search=search,
        is_active=is_active,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/it-directions/{direction_id}", response_model=ITDirectionRead)
def get_direction(direction_id: UUID, db: Session = Depends(get_db_session)):
    return ITDirectionService(db).get_direction(direction_id)


@router.post("/it-directions", response_model=ITDirectionRead, status_code=201)
def create_direction(
    payload: ITDirectionCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return ITDirectionService(db).create_direction(payload)


@router.patch("/it-directions/{direction_id}", response_model=ITDirectionRead)
def update_direction(
    direction_id: UUID,
    payload: ITDirectionUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return ITDirectionService(db).update_direction(direction_id, payload)


@router.patch("/it-directions/{direction_id}/deactivate", response_model=ITDirectionRead)
def deactivate_direction(
    direction_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return ITDirectionService(db).deactivate_direction(direction_id)


@router.get("/it-programs", response_model=Page[ITProgramRead])
def list_programs(
    search: str | None = None,
    direction_id: UUID | None = None,
    is_active: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = ITProgramService(db).list_programs(
        search=search,
        direction_id=direction_id,
        is_active=is_active,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/it-programs/{program_id}", response_model=ITProgramRead)
def get_program(program_id: UUID, db: Session = Depends(get_db_session)):
    return ITProgramService(db).get_program(program_id)


@router.post("/it-programs", response_model=ITProgramRead, status_code=201)
def create_program(
    payload: ITProgramCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return ITProgramService(db).create_program(payload)


@router.patch("/it-programs/{program_id}", response_model=ITProgramRead)
def update_program(
    program_id: UUID,
    payload: ITProgramUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return ITProgramService(db).update_program(program_id, payload)


@router.patch("/it-programs/{program_id}/deactivate", response_model=ITProgramRead)
def deactivate_program(
    program_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return ITProgramService(db).deactivate_program(program_id)

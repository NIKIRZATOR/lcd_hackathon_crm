from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import (
    CRM_ROLES,
    ensure_can_create_interaction,
    ensure_can_delete_interaction,
    ensure_can_read_interaction,
    ensure_can_update_interaction,
    resolve_interaction_manager_filter,
)
from app.modules.auth.dependencies import require_roles
from app.modules.interactions.schemas import (
    UniversityInteractionCreate,
    UniversityInteractionRead,
    UniversityInteractionUpdate,
)
from app.modules.interactions.service import UniversityInteractionService
from app.modules.users.model import User

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
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    scoped_manager_user_id = resolve_interaction_manager_filter(
        db=db,
        current_user=current_user,
        requested_manager_user_id=manager_user_id,
    )
    result = UniversityInteractionService(db).list_interactions(
        university_id=university_id,
        program_id=program_id,
        product_id=product_id,
        manager_user_id=scoped_manager_user_id,
        status_value=status,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/{interaction_id}", response_model=UniversityInteractionRead)
def get_interaction(
    interaction_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    interaction = UniversityInteractionService(db).get_interaction(interaction_id)
    ensure_can_read_interaction(db, current_user, interaction)
    return interaction


@router.post("", response_model=UniversityInteractionRead, status_code=201)
def create_interaction(
    payload: UniversityInteractionCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    ensure_can_create_interaction(db, current_user, payload.manager_user_id)
    return UniversityInteractionService(db).create_interaction(payload)


@router.patch("/{interaction_id}", response_model=UniversityInteractionRead)
def update_interaction(
    interaction_id: UUID,
    payload: UniversityInteractionUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    service = UniversityInteractionService(db)
    interaction = service.get_interaction(interaction_id)
    ensure_can_update_interaction(db, current_user, interaction, payload)
    return service.update_interaction(interaction_id, payload, changed_by_user_id=current_user.id)


@router.delete("/{interaction_id}", status_code=204)
def delete_interaction(
    interaction_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    ensure_can_delete_interaction(current_user)
    UniversityInteractionService(db).delete_interaction(interaction_id)

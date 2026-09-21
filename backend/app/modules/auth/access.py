from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.modules.contacts.model import UniversityContact
from app.modules.interactions.model import UniversityInteraction
from app.modules.interactions.schemas import UniversityInteractionUpdate
from app.modules.users.model import User


CRM_ROLES = ("KAM", "MANAGER", "ADMIN")
CATALOG_WRITE_ROLES = ("MANAGER", "ADMIN")
ADMIN_ROLES = ("ADMIN",)

KAM_ALLOWED_INTERACTION_UPDATE_FIELDS = {"status", "started_at", "completed_at", "comment"}


def get_user_roles(user: User) -> set[str]:
    return {role.name for role in user.roles}


def has_any_role(user: User, *roles: str) -> bool:
    return bool(get_user_roles(user) & set(roles))


def is_admin(user: User) -> bool:
    return has_any_role(user, "ADMIN")


def can_access_all_interactions(user: User) -> bool:
    # Manager hierarchy is not modeled yet, so MANAGER temporarily has global read/write scope.
    return has_any_role(user, "MANAGER", "ADMIN")


def forbidden(detail: str = "Insufficient permissions") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def resolve_interaction_manager_filter(
    *,
    current_user: User,
    requested_manager_user_id: UUID | None,
) -> UUID | None:
    if can_access_all_interactions(current_user):
        return requested_manager_user_id

    if has_any_role(current_user, "KAM"):
        if requested_manager_user_id is not None and requested_manager_user_id != current_user.id:
            raise forbidden("Cannot filter interactions by another manager")
        return current_user.id

    raise forbidden()


def ensure_can_read_interaction(current_user: User, interaction: UniversityInteraction) -> None:
    if can_access_all_interactions(current_user):
        return
    if has_any_role(current_user, "KAM") and interaction.manager_user_id == current_user.id:
        return
    raise forbidden("Cannot access this interaction")


def ensure_can_create_interaction(current_user: User, manager_user_id: UUID) -> None:
    if can_access_all_interactions(current_user):
        return
    if has_any_role(current_user, "KAM") and manager_user_id == current_user.id:
        return
    raise forbidden("Cannot create interaction for another manager")


def ensure_can_update_interaction(
    current_user: User,
    interaction: UniversityInteraction,
    payload: UniversityInteractionUpdate,
) -> None:
    if can_access_all_interactions(current_user):
        return

    if not has_any_role(current_user, "KAM") or interaction.manager_user_id != current_user.id:
        raise forbidden("Cannot update this interaction")

    blocked_fields = payload.model_fields_set - KAM_ALLOWED_INTERACTION_UPDATE_FIELDS
    if blocked_fields:
        raise forbidden("Cannot update restricted interaction fields")


def ensure_can_delete_interaction(current_user: User) -> None:
    if not is_admin(current_user):
        raise forbidden("Only ADMIN can delete interactions")


def ensure_can_read_university(db: Session, current_user: User, university_id: UUID) -> None:
    if can_access_all_interactions(current_user):
        return
    if has_any_role(current_user, "KAM") and _has_manager_university_access(db, current_user.id, university_id):
        return
    raise forbidden("Cannot access this university")


def ensure_can_read_contact(db: Session, current_user: User, contact: UniversityContact) -> None:
    ensure_can_read_university(db, current_user, contact.university_id)


def _has_manager_university_access(db: Session, manager_user_id: UUID, university_id: UUID) -> bool:
    statement = select(
        exists().where(
            UniversityInteraction.manager_user_id == manager_user_id,
            UniversityInteraction.university_id == university_id,
        )
    )
    return bool(db.scalar(statement))

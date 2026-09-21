from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from app.modules.contacts.model import UniversityContact
from app.modules.interactions.model import UniversityInteraction
from app.modules.interactions.schemas import UniversityInteractionUpdate
from app.modules.users.model import DataAccessScope, ManagerMembership, User

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


def forbidden(detail: str = "Insufficient permissions") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def get_subordinate_kam_ids(db: Session, manager_user_id: UUID) -> set[UUID]:
    now = datetime.now(timezone.utc)
    statement = select(ManagerMembership.kam_user_id).where(
        ManagerMembership.manager_user_id == manager_user_id,
        ManagerMembership.is_active.is_(True),
        or_(ManagerMembership.valid_from.is_(None), ManagerMembership.valid_from <= now),
        or_(ManagerMembership.valid_to.is_(None), ManagerMembership.valid_to >= now),
    )
    return set(db.scalars(statement).all())


def resolve_visible_manager_ids(db: Session, current_user: User) -> set[UUID] | None:
    if is_admin(current_user):
        return None
    if has_any_role(current_user, "MANAGER"):
        return get_subordinate_kam_ids(db, current_user.id)
    if has_any_role(current_user, "KAM"):
        return {current_user.id}
    raise forbidden()


def resolve_interaction_manager_filter(
    *,
    db: Session,
    current_user: User,
    requested_manager_user_id: UUID | None,
) -> UUID | set[UUID] | None:
    if is_admin(current_user):
        return requested_manager_user_id

    if has_any_role(current_user, "MANAGER"):
        kam_ids = get_subordinate_kam_ids(db, current_user.id)
        if requested_manager_user_id is not None:
            if requested_manager_user_id not in kam_ids:
                raise forbidden("Cannot filter interactions outside manager scope")
            return requested_manager_user_id
        return kam_ids

    if has_any_role(current_user, "KAM"):
        if requested_manager_user_id is not None and requested_manager_user_id != current_user.id:
            raise forbidden("Cannot filter interactions by another manager")
        return current_user.id

    raise forbidden()


def ensure_can_read_interaction(db: Session, current_user: User, interaction: UniversityInteraction) -> None:
    if is_admin(current_user):
        return
    if has_any_role(current_user, "KAM") and interaction.manager_user_id == current_user.id:
        return
    if has_any_role(current_user, "MANAGER") and interaction.manager_user_id in get_subordinate_kam_ids(
        db, current_user.id
    ):
        return
    if _has_explicit_scope(db, current_user.id, university_id=interaction.university_id, interaction_id=interaction.id):
        return
    raise forbidden("Cannot access this interaction")


def ensure_can_create_interaction(db: Session, current_user: User, manager_user_id: UUID) -> None:
    if is_admin(current_user):
        return
    if has_any_role(current_user, "MANAGER") and manager_user_id in get_subordinate_kam_ids(db, current_user.id):
        return
    if has_any_role(current_user, "KAM") and manager_user_id == current_user.id:
        return
    raise forbidden("Cannot create interaction for this manager")


def ensure_can_update_interaction(
    db: Session,
    current_user: User,
    interaction: UniversityInteraction,
    payload: UniversityInteractionUpdate,
) -> None:
    if is_admin(current_user):
        return

    if has_any_role(current_user, "MANAGER"):
        kam_ids = get_subordinate_kam_ids(db, current_user.id)
        new_manager_user_id = payload.manager_user_id
        if interaction.manager_user_id in kam_ids and (new_manager_user_id is None or new_manager_user_id in kam_ids):
            return
        raise forbidden("Cannot update interaction outside manager scope")

    if not has_any_role(current_user, "KAM") or interaction.manager_user_id != current_user.id:
        raise forbidden("Cannot update this interaction")

    blocked_fields = payload.model_fields_set - KAM_ALLOWED_INTERACTION_UPDATE_FIELDS
    if blocked_fields:
        raise forbidden("Cannot update restricted interaction fields")


def ensure_can_delete_interaction(current_user: User) -> None:
    if not is_admin(current_user):
        raise forbidden("Only ADMIN can delete interactions")


def ensure_can_read_university(db: Session, current_user: User, university_id: UUID) -> None:
    if is_admin(current_user):
        return
    if _has_visible_university_interaction(db, current_user, university_id):
        return
    if _has_explicit_scope(db, current_user.id, university_id=university_id):
        return
    raise forbidden("Cannot access this university")


def ensure_can_read_contact(db: Session, current_user: User, contact: UniversityContact) -> None:
    ensure_can_read_university(db, current_user, contact.university_id)


def _has_visible_university_interaction(db: Session, current_user: User, university_id: UUID) -> bool:
    manager_ids: set[UUID]
    if has_any_role(current_user, "MANAGER"):
        manager_ids = get_subordinate_kam_ids(db, current_user.id)
    elif has_any_role(current_user, "KAM"):
        manager_ids = {current_user.id}
    else:
        return False

    if not manager_ids:
        return False

    statement = select(
        exists().where(
            UniversityInteraction.university_id == university_id,
            UniversityInteraction.manager_user_id.in_(manager_ids),
        )
    )
    return bool(db.scalar(statement))


def _has_explicit_scope(
    db: Session,
    subject_user_id: UUID,
    *,
    university_id: UUID | None = None,
    interaction_id: UUID | None = None,
) -> bool:
    now = datetime.now(timezone.utc)
    statement = select(
        exists().where(
            DataAccessScope.subject_user_id == subject_user_id,
            DataAccessScope.is_active.is_(True),
            or_(DataAccessScope.valid_from.is_(None), DataAccessScope.valid_from <= now),
            or_(DataAccessScope.valid_to.is_(None), DataAccessScope.valid_to >= now),
            or_(DataAccessScope.access_level == "READ", DataAccessScope.access_level == "WRITE"),
        )
    )
    if interaction_id is not None:
        statement = statement.where(DataAccessScope.interaction_id == interaction_id)
    elif university_id is not None:
        statement = statement.where(DataAccessScope.university_id == university_id)
    else:
        return False
    return bool(db.scalar(statement))

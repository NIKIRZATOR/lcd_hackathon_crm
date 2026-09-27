from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.audit.schemas import AuditEventRead
from app.modules.audit.service import AuditService
from app.modules.auth.access import ADMIN_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.users.model import User

router = APIRouter(prefix="/audit", tags=["audit"])


AUDIT_ERROR_RESPONSES = {
    401: {"description": "Bearer token is missing or invalid."},
    403: {"description": "Only ADMIN users can read audit events."},
    422: {"description": "Request validation failed."},
}


@router.get(
    "/events",
    response_model=Page[AuditEventRead],
    summary="List audit events",
    description=(
        "Returns the backend audit trail. This is an ADMIN-only endpoint. "
        "It supports filtering by actor, action, entity, result and date range. "
        "Audit metadata is intended for safe technical context only and must not contain tokens, secrets or raw payloads "
        "with excessive personal data."
    ),
    responses=AUDIT_ERROR_RESPONSES,
)
def list_audit_events(
    actor_user_id: UUID | None = None,
    actor_role: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    result: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    events = AuditService(db).list_events(
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        result=result,
        date_from=date_from,
        date_to=date_to,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(
        items=[_event_read(event, db) for event in events.items],
        total=events.total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


def _event_read(event, db: Session) -> AuditEventRead:
    actor = db.get(User, event.actor_user_id) if event.actor_user_id else None
    return AuditEventRead.model_validate(event).model_copy(
        update={
            "actor_name": actor.full_name if actor else None,
            "actor_roles": sorted(role.name for role in actor.roles) if actor else [],
        }
    )

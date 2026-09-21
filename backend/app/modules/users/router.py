from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.common.errors import get_request_id
from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.audit.service import AuditService
from app.modules.auth.access import ADMIN_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.users.model import User
from app.modules.users.schemas import ManagerMembershipCreate, ManagerMembershipRead, ManagerMembershipUpdate
from app.modules.users.service import ManagerMembershipService

router = APIRouter(prefix="/users", tags=["users"])

USERS_ADMIN_ERROR_RESPONSES = {
    401: {"description": "Bearer token is missing or invalid."},
    403: {"description": "Only ADMIN users can manage manager memberships."},
    422: {"description": "Request validation failed."},
}


@router.get(
    "/manager-memberships",
    response_model=Page[ManagerMembershipRead],
    summary="List manager memberships",
    description=(
        "Returns MANAGER to KAM relations used by backend data scope. "
        "This is an ADMIN-only endpoint. Filters can narrow the result to one manager, one KAM or active/inactive links."
    ),
    responses=USERS_ADMIN_ERROR_RESPONSES,
)
def list_manager_memberships(
    manager_user_id: UUID | None = None,
    kam_user_id: UUID | None = None,
    is_active: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    result = ManagerMembershipService(db).list_memberships(
        manager_user_id=manager_user_id,
        kam_user_id=kam_user_id,
        is_active=is_active,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.post(
    "/manager-memberships",
    response_model=ManagerMembershipRead,
    status_code=201,
    summary="Create or reactivate manager membership",
    description=(
        "Creates a MANAGER to KAM relation or reactivates an existing pair. "
        "`manager_user_id` must reference a user with the MANAGER role, and `kam_user_id` must reference a user with "
        "the KAM role. Successful changes are written to audit events."
    ),
    responses={
        **USERS_ADMIN_ERROR_RESPONSES,
        400: {"description": "Referenced users do not exist, have wrong roles or point to the same user."},
    },
)
def create_manager_membership(
    payload: ManagerMembershipCreate,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    membership = ManagerMembershipService(db).create_membership(payload)
    AuditService(db).log_event(
        actor_user_id=current_user.id,
        action="manager_membership.create",
        entity_type="manager_membership",
        entity_id=membership.id,
        metadata={"manager_user_id": str(membership.manager_user_id), "kam_user_id": str(membership.kam_user_id)},
        request_id=get_request_id(request),
    )
    return membership


@router.patch(
    "/manager-memberships/{membership_id}",
    response_model=ManagerMembershipRead,
    summary="Update manager membership",
    description=(
        "Updates validity dates or active status for an existing MANAGER to KAM relation. "
        "Successful changes are written to audit events."
    ),
    responses={
        **USERS_ADMIN_ERROR_RESPONSES,
        404: {"description": "Manager membership was not found."},
    },
)
def update_manager_membership(
    membership_id: UUID,
    payload: ManagerMembershipUpdate,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    membership = ManagerMembershipService(db).update_membership(membership_id, payload)
    AuditService(db).log_event(
        actor_user_id=current_user.id,
        action="manager_membership.update",
        entity_type="manager_membership",
        entity_id=membership.id,
        metadata={"fields": sorted(payload.model_fields_set)},
        request_id=get_request_id(request),
    )
    return membership


@router.patch(
    "/manager-memberships/{membership_id}/deactivate",
    response_model=ManagerMembershipRead,
    summary="Deactivate manager membership",
    description=(
        "Marks a MANAGER to KAM relation as inactive. The relation stops contributing to MANAGER data scope after "
        "deactivation. Successful changes are written to audit events."
    ),
    responses={
        **USERS_ADMIN_ERROR_RESPONSES,
        404: {"description": "Manager membership was not found."},
    },
)
def deactivate_manager_membership(
    membership_id: UUID,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    membership = ManagerMembershipService(db).deactivate_membership(membership_id)
    AuditService(db).log_event(
        actor_user_id=current_user.id,
        action="manager_membership.deactivate",
        entity_type="manager_membership",
        entity_id=membership.id,
        metadata={"manager_user_id": str(membership.manager_user_id), "kam_user_id": str(membership.kam_user_id)},
        request_id=get_request_id(request),
    )
    return membership

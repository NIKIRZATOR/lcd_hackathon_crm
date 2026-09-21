from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.common.errors import get_request_id
from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.audit.service import AuditService
from app.modules.auth.access import (
    CRM_ROLES,
    ensure_can_create_interaction,
    ensure_can_delete_interaction,
    ensure_can_read_interaction,
    ensure_can_assign_interaction,
    ensure_can_update_interaction,
    resolve_interaction_manager_filter,
)
from app.modules.auth.dependencies import require_roles
from app.modules.interactions.schemas import (
    ResponsibleAssignmentHistoryRead,
    UniversityInteractionAssign,
    UniversityInteractionCreate,
    UniversityInteractionRead,
    UniversityInteractionUpdate,
)
from app.modules.interactions.service import UniversityInteractionService
from app.modules.users.model import User

router = APIRouter(prefix="/interactions", tags=["interactions"])

COMMON_ERROR_RESPONSES = {
    401: {
        "description": "Bearer token is missing or invalid.",
        "content": {
            "application/json": {
                "example": {
                    "code": "UNAUTHORIZED",
                    "message": "Not authenticated",
                    "details": None,
                    "requestId": "6f3f843b-4e5c-46df-9df7-0628d88f3d3c",
                }
            }
        },
    },
    403: {
        "description": "Authenticated user does not have the required role or data scope.",
        "content": {
            "application/json": {
                "example": {
                    "code": "FORBIDDEN",
                    "message": "Cannot access this interaction",
                    "details": None,
                    "requestId": "6f3f843b-4e5c-46df-9df7-0628d88f3d3c",
                }
            }
        },
    },
    422: {
        "description": "Request validation failed.",
        "content": {
            "application/json": {
                "example": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": [],
                    "requestId": "6f3f843b-4e5c-46df-9df7-0628d88f3d3c",
                }
            }
        },
    },
}


@router.get(
    "",
    response_model=Page[UniversityInteractionRead],
    summary="List university interactions",
    description=(
        "Returns university interactions available to the current user. "
        "KAM users are restricted to their own interactions. MANAGER users are restricted to interactions of "
        "their subordinate KAM users. ADMIN users can see all interactions. Query filters are applied after "
        "server-side data scope rules, so they cannot be used to bypass access control."
    ),
    responses=COMMON_ERROR_RESPONSES,
)
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


@router.get(
    "/{interaction_id}",
    response_model=UniversityInteractionRead,
    summary="Get university interaction",
    description=(
        "Returns one interaction if it is inside the current user's data scope. "
        "KAM users can read only their own interactions. MANAGER users can read interactions of subordinate KAM users. "
        "ADMIN users can read any interaction."
    ),
    responses={
        **COMMON_ERROR_RESPONSES,
        404: {
            "description": "Interaction was not found.",
            "content": {
                "application/json": {
                    "example": {
                        "code": "NOT_FOUND",
                        "message": "University interaction not found",
                        "details": None,
                        "requestId": "6f3f843b-4e5c-46df-9df7-0628d88f3d3c",
                    }
                }
            },
        },
    },
)
def get_interaction(
    interaction_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    interaction = UniversityInteractionService(db).get_interaction(interaction_id)
    ensure_can_read_interaction(db, current_user, interaction)
    return interaction


@router.get(
    "/{interaction_id}/assignment-history",
    response_model=Page[ResponsibleAssignmentHistoryRead],
    summary="List responsible assignment history",
    description="Returns assignment changes for an interaction if it is inside the current user's data scope.",
    responses=COMMON_ERROR_RESPONSES,
)
def list_assignment_history(
    interaction_id: UUID,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    service = UniversityInteractionService(db)
    interaction = service.get_interaction(interaction_id)
    ensure_can_read_interaction(db, current_user, interaction)
    result = service.list_assignment_history(
        interaction_id=interaction_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.post(
    "",
    response_model=UniversityInteractionRead,
    status_code=201,
    summary="Create university interaction",
    description=(
        "Creates an interaction and initializes workflow stage instances from the selected workflow template. "
        "KAM users can create interactions only for themselves. MANAGER users can create interactions only for "
        "their subordinate KAM users. ADMIN users can create interactions for any responsible user."
    ),
    responses={
        **COMMON_ERROR_RESPONSES,
        400: {
            "description": "Related entity does not exist or workflow template cannot initialize runtime stages.",
            "content": {
                "application/json": {
                    "example": {
                        "code": "BAD_REQUEST",
                        "message": "Workflow template has no active stages",
                        "details": None,
                        "requestId": "6f3f843b-4e5c-46df-9df7-0628d88f3d3c",
                    }
                }
            },
        },
    },
)
def create_interaction(
    payload: UniversityInteractionCreate,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    ensure_can_create_interaction(db, current_user, payload.manager_user_id)
    interaction = UniversityInteractionService(db).create_interaction(payload)
    AuditService(db).log_event(
        actor_user_id=current_user.id,
        action="interaction.create",
        entity_type="interaction",
        entity_id=interaction.id,
        metadata={
            "university_id": str(interaction.university_id),
            "program_id": str(interaction.program_id),
            "product_id": str(interaction.product_id),
            "manager_user_id": str(interaction.manager_user_id) if interaction.manager_user_id else None,
        },
        request_id=get_request_id(request),
    )
    return interaction


@router.patch(
    "/{interaction_id}",
    response_model=UniversityInteractionRead,
    summary="Update university interaction fields",
    description=(
        "Updates editable interaction fields such as status, contract data, license data, transfer status, "
        "university responsibles and comment. This endpoint does not change the responsible KAM. "
        "Use `POST /api/interactions/{interaction_id}/assign` for assignment changes so the assignment history "
        "is always recorded."
    ),
    responses={
        **COMMON_ERROR_RESPONSES,
        400: {
            "description": "Invalid update, for example changing manager_user_id through this endpoint.",
            "content": {
                "application/json": {
                    "example": {
                        "code": "BAD_REQUEST",
                        "message": "Use assignment endpoint to change interaction manager",
                        "details": None,
                        "requestId": "6f3f843b-4e5c-46df-9df7-0628d88f3d3c",
                    }
                }
            },
        },
        404: {
            "description": "Interaction was not found.",
        },
    },
)
def update_interaction(
    interaction_id: UUID,
    payload: UniversityInteractionUpdate,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    service = UniversityInteractionService(db)
    interaction = service.get_interaction(interaction_id)
    if "manager_user_id" in payload.model_fields_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use assignment endpoint to change interaction manager",
        )
    ensure_can_update_interaction(db, current_user, interaction, payload)
    interaction = service.update_interaction(interaction_id, payload, changed_by_user_id=current_user.id)
    AuditService(db).log_event(
        actor_user_id=current_user.id,
        action="interaction.update",
        entity_type="interaction",
        entity_id=interaction.id,
        metadata={"fields": sorted(payload.model_fields_set)},
        request_id=get_request_id(request),
    )
    return interaction


@router.post(
    "/{interaction_id}/assign",
    response_model=UniversityInteractionRead,
    summary="Assign or unassign responsible KAM",
    description=(
        "Changes the responsible KAM for an interaction or removes the assignee when `manager_user_id` is null. "
        "Every successful change writes a row to `responsible_assignment_history` and updates active workflow stage "
        "responsibles. MANAGER users can assign only interactions already in their scope and only to their subordinate "
        "KAM users. ADMIN users can assign or unassign any interaction."
    ),
    responses={
        **COMMON_ERROR_RESPONSES,
        400: {
            "description": "New responsible user does not exist.",
            "content": {
                "application/json": {
                    "example": {
                        "code": "BAD_REQUEST",
                        "message": "Manager user not found",
                        "details": None,
                        "requestId": "6f3f843b-4e5c-46df-9df7-0628d88f3d3c",
                    }
                }
            },
        },
        404: {
            "description": "Interaction was not found.",
        },
    },
)
def assign_interaction(
    interaction_id: UUID,
    payload: UniversityInteractionAssign,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles("MANAGER", "ADMIN")),
):
    service = UniversityInteractionService(db)
    interaction = service.get_interaction(interaction_id)
    old_manager_user_id = interaction.manager_user_id
    ensure_can_assign_interaction(db, current_user, interaction, payload.manager_user_id)
    interaction = service.assign_interaction(interaction_id, payload, changed_by_user_id=current_user.id)
    AuditService(db).log_event(
        actor_user_id=current_user.id,
        action="interaction.assign",
        entity_type="interaction",
        entity_id=interaction.id,
        reason=payload.reason,
        metadata={
            "old_manager_user_id": str(old_manager_user_id) if old_manager_user_id else None,
            "new_manager_user_id": str(payload.manager_user_id) if payload.manager_user_id else None,
        },
        request_id=get_request_id(request),
    )
    return interaction


@router.delete(
    "/{interaction_id}",
    status_code=204,
    summary="Delete university interaction",
    description=(
        "Deletes an interaction and its workflow runtime records. This is an ADMIN-only operation because it removes "
        "business history from the active CRM dataset."
    ),
    responses={
        **COMMON_ERROR_RESPONSES,
        404: {
            "description": "Interaction was not found.",
        },
    },
)
def delete_interaction(
    interaction_id: UUID,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    ensure_can_delete_interaction(current_user)
    UniversityInteractionService(db).delete_interaction(interaction_id)
    AuditService(db).log_event(
        actor_user_id=current_user.id,
        action="interaction.delete",
        entity_type="interaction",
        entity_id=interaction_id,
        request_id=get_request_id(request),
    )

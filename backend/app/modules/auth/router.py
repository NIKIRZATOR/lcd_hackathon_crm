from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, aliased

from app.core.database import get_db_session
from app.core.config import settings
from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.schemas import CurrentUserRead, TokenRead
from app.modules.users.model import ManagerMembership, User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/token",
    response_model=TokenRead,
    summary="Get Keycloak access token for Swagger",
    description=(
        "Development/demo helper for Swagger authorization. Accepts username and password, requests a Keycloak "
        "password-grant token through the public frontend client, and returns a bearer token that Swagger can use for "
        "protected API calls."
    ),
    responses={
        400: {"description": "Invalid username/password or Keycloak rejected the password grant."},
        503: {"description": "Keycloak token endpoint is unavailable."},
    },
)
def login_for_swagger(form: OAuth2PasswordRequestForm = Depends()) -> TokenRead:
    data = {
        "grant_type": "password",
        "client_id": settings.keycloak_frontend_client_id,
        "username": form.username,
        "password": form.password,
    }
    if form.scopes:
        data["scope"] = " ".join(form.scopes)

    try:
        response = httpx.post(settings.keycloak_token_url, data=data, timeout=10)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Keycloak token endpoint is unavailable",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid username or password",
        )

    payload = response.json()
    return TokenRead(
        access_token=payload["access_token"],
        token_type=payload.get("token_type", "bearer"),
        expires_in=payload.get("expires_in"),
        refresh_expires_in=payload.get("refresh_expires_in"),
        refresh_token=payload.get("refresh_token"),
        scope=payload.get("scope"),
    )


def _to_current_user_read(
    user: User,
    supervisor_name: str | None,
    team_members: list[str],
) -> CurrentUserRead:
    return CurrentUserRead(
        id=user.id,
        keycloak_user_id=user.keycloak_user_id,
        username=user.username or user.email or user.full_name,
        email=user.email,
        full_name=user.full_name,
        roles=[role.name for role in user.roles],
        has_avatar=user.avatar_file_id is not None,
        supervisor_name=supervisor_name,
        team_members=team_members,
    )


@router.get("/me", response_model=CurrentUserRead)
def read_current_user(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> CurrentUserRead:
    manager = aliased(User)
    now = datetime.now(timezone.utc)
    supervisor = db.execute(
        select(manager.id, manager.full_name)
        .join(ManagerMembership, ManagerMembership.manager_user_id == manager.id)
        .where(
            ManagerMembership.kam_user_id == current_user.id,
            ManagerMembership.is_active.is_(True),
            or_(ManagerMembership.valid_from.is_(None), ManagerMembership.valid_from <= now),
            or_(ManagerMembership.valid_to.is_(None), ManagerMembership.valid_to >= now),
        )
        .order_by(manager.full_name)
        .limit(1)
    ).first()
    team_manager_id = current_user.id if any(role.name == "MANAGER" for role in current_user.roles) else (supervisor[0] if supervisor else None)
    team_members = (
        list(
            db.scalars(
                select(User.full_name)
                .join(ManagerMembership, ManagerMembership.kam_user_id == User.id)
                .where(
                    ManagerMembership.manager_user_id == team_manager_id,
                    ManagerMembership.is_active.is_(True),
                    or_(ManagerMembership.valid_from.is_(None), ManagerMembership.valid_from <= now),
                    or_(ManagerMembership.valid_to.is_(None), ManagerMembership.valid_to >= now),
                )
                .order_by(User.full_name)
            ).all()
        )
        if team_manager_id is not None
        else []
    )
    return _to_current_user_read(current_user, supervisor[1] if supervisor else None, team_members)


@router.get("/role-check")
def role_check(current_user: User = Depends(require_roles("KAM", "MANAGER", "ADMIN"))) -> dict[str, object]:
    return {
        "status": "ok",
        "user_id": str(current_user.id),
        "roles": [role.name for role in current_user.roles],
    }

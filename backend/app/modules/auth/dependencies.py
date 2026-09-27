from collections.abc import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.core.config import settings
from app.core.security import get_token_verifier
from app.modules.users.model import User
from app.modules.users.service import SUPPORTED_AUTH_ROLES, UserService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def get_token_roles(payload: dict) -> set[str]:
    resource_access = payload.get("resource_access") or {}
    client_access = resource_access.get(settings.keycloak_backend_client_id) or {}
    client_roles = set(client_access.get("roles") or [])
    realm_access = payload.get("realm_access") or {}
    realm_roles = set(realm_access.get("roles") or [])
    return (client_roles | realm_roles) & SUPPORTED_AUTH_ROLES


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db_session),
) -> User:
    payload = get_token_verifier().verify(token)
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token subject is missing")

    username = payload.get("preferred_username") or payload.get("email") or subject
    full_name = payload.get("name") or username
    email = payload.get("email")
    roles = get_token_roles(payload)

    user = UserService(db).sync_keycloak_user(
        keycloak_user_id=UUID(subject),
        username=username,
        email=email,
        full_name=full_name,
        roles=roles,
    )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
    return user


def require_roles(*required_roles: str) -> Callable[[User], User]:
    required = set(required_roles)

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        user_roles = {role.name for role in current_user.roles}
        if not user_roles & required:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return current_user

    return dependency

from fastapi import APIRouter
from fastapi import Depends

from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.schemas import CurrentUserRead
from app.modules.users.model import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_current_user_read(user: User) -> CurrentUserRead:
    return CurrentUserRead(
        id=user.id,
        keycloak_user_id=user.keycloak_user_id,
        username=user.username or user.email or user.full_name,
        email=user.email,
        full_name=user.full_name,
        roles=[role.name for role in user.roles],
    )


@router.get("/me", response_model=CurrentUserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> CurrentUserRead:
    return _to_current_user_read(current_user)


@router.get("/role-check")
def role_check(current_user: User = Depends(require_roles("KAM", "MANAGER", "ADMIN"))) -> dict[str, object]:
    return {
        "status": "ok",
        "user_id": str(current_user.id),
        "roles": [role.name for role in current_user.roles],
    }

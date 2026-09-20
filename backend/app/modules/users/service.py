from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.users.model import Role, User
from app.modules.users.repository import UserRepository


SUPPORTED_AUTH_ROLES = {"KAM", "MANAGER", "ADMIN"}


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = UserRepository(db)

    def sync_keycloak_user(
        self,
        *,
        keycloak_user_id: UUID,
        username: str,
        email: str | None,
        full_name: str | None,
        roles: set[str],
    ) -> User:
        auth_roles = roles & SUPPORTED_AUTH_ROLES
        local_roles = self._get_or_create_roles(auth_roles)
        primary_role = local_roles[0].name if local_roles else "USER"

        user = self.repository.get_by_keycloak_user_id(keycloak_user_id)
        if user is None:
            user = User(
                keycloak_user_id=keycloak_user_id,
                username=username,
                full_name=full_name or username,
                email=email,
                role=primary_role,
                is_active=True,
                roles=local_roles,
            )
            self.repository.add_user(user)
        else:
            user.username = username
            user.full_name = full_name or user.full_name or username
            user.email = email
            user.role = primary_role
            user.roles = local_roles

        self.db.commit()
        self.db.refresh(user)
        return user

    def _get_or_create_roles(self, names: set[str]) -> list[Role]:
        existing_roles = {role.name: role for role in self.repository.get_roles_by_names(names)}
        missing_names = names - set(existing_roles)
        for name in missing_names:
            role = Role(name=name, description=f"{name} role from Keycloak")
            self.db.add(role)
            existing_roles[name] = role
        self.db.flush()
        return [existing_roles[name] for name in sorted(existing_roles)]

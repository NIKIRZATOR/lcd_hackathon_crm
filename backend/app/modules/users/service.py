from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.users.model import ManagerMembership, Role, User
from app.modules.users.repository import ManagerMembershipRepository, UserRepository
from app.modules.users.schemas import ManagerMembershipCreate, ManagerMembershipUpdate


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
            user = self.repository.get_by_username(username)
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
            user.keycloak_user_id = keycloak_user_id
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

    def list_users(
        self,
        *,
        search: str | None,
        is_active: bool | None,
        role: str | None,
        limit: int,
        offset: int,
    ) -> ListResult[User]:
        return self.repository.list_users(
            search=search,
            is_active=is_active,
            role=role,
            limit=limit,
            offset=offset,
        )

    def set_active(self, user_id: UUID, is_active: bool) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        user.is_active = is_active
        self.db.commit()
        self.db.refresh(user)
        return user


class ManagerMembershipService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = ManagerMembershipRepository(db)

    def list_memberships(
        self,
        *,
        manager_user_id: UUID | None,
        kam_user_id: UUID | None,
        is_active: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[ManagerMembership]:
        return self.repository.list(
            manager_user_id=manager_user_id,
            kam_user_id=kam_user_id,
            is_active=is_active,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def create_membership(self, payload: ManagerMembershipCreate) -> ManagerMembership:
        manager = self._get_user_with_role(payload.manager_user_id, "MANAGER", "Manager user not found")
        kam = self._get_user_with_role(payload.kam_user_id, "KAM", "KAM user not found")
        if manager.id == kam.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manager and KAM must be different users")

        membership = self.repository.get_by_pair(payload.manager_user_id, payload.kam_user_id)
        if membership is None:
            membership = ManagerMembership(**payload.model_dump(), is_active=True)
            self.repository.add(membership)
        else:
            membership.valid_from = payload.valid_from
            membership.valid_to = payload.valid_to
            membership.is_active = True

        self.db.commit()
        self.db.refresh(membership)
        return membership

    def update_membership(self, membership_id: UUID, payload: ManagerMembershipUpdate) -> ManagerMembership:
        membership = self._get_membership(membership_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(membership, field, value)
        self.db.commit()
        self.db.refresh(membership)
        return membership

    def deactivate_membership(self, membership_id: UUID) -> ManagerMembership:
        membership = self._get_membership(membership_id)
        membership.is_active = False
        self.db.commit()
        self.db.refresh(membership)
        return membership

    def _get_membership(self, membership_id: UUID) -> ManagerMembership:
        membership = self.repository.get(membership_id)
        if membership is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager membership not found")
        return membership

    def _get_user_with_role(self, user_id: UUID, role: str, not_found_message: str) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=not_found_message)
        if role not in {item.name for item in user.roles}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User must have {role} role")
        return user

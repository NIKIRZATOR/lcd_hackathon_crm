from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.users.model import ManagerMembership, Role, User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_keycloak_user_id(self, keycloak_user_id: UUID) -> User | None:
        statement = select(User).where(User.keycloak_user_id == keycloak_user_id)
        return self.db.scalar(statement)

    def get_by_username(self, username: str) -> User | None:
        statement = select(User).where(User.username == username)
        return self.db.scalar(statement)

    def get_role_by_name(self, name: str) -> Role | None:
        statement = select(Role).where(Role.name == name)
        return self.db.scalar(statement)

    def get_roles_by_names(self, names: set[str]) -> list[Role]:
        if not names:
            return []
        statement = select(Role).where(Role.name.in_(names))
        return list(self.db.scalars(statement).all())

    def add_user(self, user: User) -> User:
        self.db.add(user)
        self.db.flush()
        return user

    def list_users(
        self,
        *,
        search: str | None,
        is_active: bool | None,
        limit: int,
        offset: int,
    ) -> ListResult[User]:
        statement = select(User)
        if search:
            pattern = f"%{search.lower()}%"
            statement = statement.where(
                func.lower(User.full_name).like(pattern)
                | func.lower(User.email).like(pattern)
                | func.lower(User.username).like(pattern)
            )
        if is_active is not None:
            statement = statement.where(User.is_active.is_(is_active))
        total = self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0
        items = list(self.db.scalars(statement.order_by(User.full_name, User.username).limit(limit).offset(offset)).all())
        return ListResult(items=items, total=total)


class ManagerMembershipRepository:
    sortable_fields = {"created_at", "updated_at", "valid_from", "valid_to"}
    default_sort = "created_at"

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, membership_id: UUID) -> ManagerMembership | None:
        return self.db.get(ManagerMembership, membership_id)

    def get_by_pair(self, manager_user_id: UUID, kam_user_id: UUID) -> ManagerMembership | None:
        statement = select(ManagerMembership).where(
            ManagerMembership.manager_user_id == manager_user_id,
            ManagerMembership.kam_user_id == kam_user_id,
        )
        return self.db.scalar(statement)

    def list(
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
        statement = select(ManagerMembership)
        filters = {
            "manager_user_id": manager_user_id,
            "kam_user_id": kam_user_id,
            "is_active": is_active,
        }
        for field, value in filters.items():
            if value is not None:
                statement = statement.where(getattr(ManagerMembership, field) == value)

        total = self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0
        order_column = getattr(ManagerMembership, self._resolve_sort_field(sort_by))
        order_expression = desc(order_column) if sort_order == "desc" else asc(order_column)
        items = list(self.db.scalars(statement.order_by(order_expression).limit(limit).offset(offset)).all())
        return ListResult(items=items, total=total)

    def add(self, membership: ManagerMembership) -> ManagerMembership:
        self.db.add(membership)
        self.db.flush()
        return membership

    def _resolve_sort_field(self, sort_by: str | None) -> str:
        if sort_by and sort_by in self.sortable_fields:
            return sort_by
        return self.default_sort

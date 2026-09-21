from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.users.model import Role, User


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

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, Table, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, ModelBase


user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", PostgresUUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
    Column("role_id", PostgresUUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True),
)


class Role(ModelBase):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class User(ModelBase):
    __tablename__ = "users"

    keycloak_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        nullable=True,
        unique=True,
    )
    username: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(64), nullable=False, default="USER")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    roles: Mapped[list[Role]] = relationship(Role, secondary=user_roles, lazy="selectin")


class ManagerMembership(ModelBase):
    __tablename__ = "manager_memberships"
    __table_args__ = (
        UniqueConstraint("manager_user_id", "kam_user_id", name="uq_manager_memberships_manager_kam"),
        Index("ix_manager_memberships_manager_active", "manager_user_id", "is_active"),
        Index("ix_manager_memberships_kam_active", "kam_user_id", "is_active"),
    )

    manager_user_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    kam_user_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ResponsibleAssignmentHistory(ModelBase):
    __tablename__ = "responsible_assignment_history"
    __table_args__ = (
        Index("ix_responsible_assignment_history_interaction_changed_at", "interaction_id", "changed_at"),
    )

    interaction_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("university_interactions.id"),
        nullable=False,
    )
    old_manager_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    new_manager_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    changed_by_user_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DataAccessScope(ModelBase):
    __tablename__ = "data_access_scopes"
    __table_args__ = (
        Index("ix_data_access_scopes_subject_active", "subject_user_id", "is_active"),
        Index("ix_data_access_scopes_university", "university_id"),
        Index("ix_data_access_scopes_interaction", "interaction_id"),
    )

    subject_user_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    university_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("universities.id"),
        nullable=True,
    )
    interaction_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("university_interactions.id"),
        nullable=True,
    )
    access_level: Mapped[str] = mapped_column(String(64), nullable=False, default="READ")
    granted_by_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

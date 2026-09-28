from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import ModelBase


class OrganizationType(ModelBase):
    __tablename__ = "organization_types"

    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Organization(ModelBase):
    __tablename__ = "organizations"
    __table_args__ = (CheckConstraint("status IN ('active', 'paused', 'archived')", name="organization_status"),)

    type_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("organization_types.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    region: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)


class OrgAssignment(ModelBase):
    __tablename__ = "org_assignments"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'ended')", name="org_assignment_status"),
        Index(
            "uq_org_assignments_active_organization",
            "organization_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        Index("ix_org_assignments_user_status", "user_id", "status"),
    )

    organization_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    assigned_by: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Stakeholder(ModelBase):
    __tablename__ = "stakeholders"
    __table_args__ = (
        CheckConstraint(
            "role_code IN ('vice_rector', 'dean', 'methodist', 'lawyer', 'chair', 'teacher', 'director', 'school_teacher', 'other')",
            name="stakeholder_role_code",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    role_code: Mapped[str] = mapped_column(String(32), nullable=False, default="other")
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    contact_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    program_instance_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("program_instances.id"), nullable=True
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

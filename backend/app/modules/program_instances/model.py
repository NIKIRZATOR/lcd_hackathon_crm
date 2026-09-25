from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import ModelBase


class AcademicWindow(ModelBase):
    __tablename__ = "academic_windows"

    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    plan_cutoff_on: Mapped[date] = mapped_column(Date, nullable=False)
    classes_start_on: Mapped[date] = mapped_column(Date, nullable=False)
    classes_end_on: Mapped[date] = mapped_column(Date, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class ProgramInstance(ModelBase):
    __tablename__ = "program_instances"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'active', 'paused', 'completed', 'cancelled')", name="program_instance_status"),
        CheckConstraint("health_band IN ('green', 'yellow', 'red')", name="program_instance_health_band"),
        CheckConstraint("health_score IS NULL OR (health_score >= 0 AND health_score <= 100)", name="program_instance_health_score"),
        Index(
            "uq_program_instances_active_scope",
            "organization_id",
            "direction_id",
            "product_id",
            unique=True,
            postgresql_where=text("status IN ('draft', 'active', 'paused')"),
        ),
        Index("ix_program_instances_kam_status_health", "kam_user_id", "status", "health_band"),
    )

    organization_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    direction_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("it_directions.id"), nullable=False)
    product_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("it_products.id"), nullable=False)
    kam_user_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    playbook_template_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("workflow_templates.id"), nullable=False)
    workflow_version_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("workflow_versions.id"), nullable=True)
    current_stage_instance_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("workflow_stage_instances.id"), nullable=True)
    template_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    current_stage_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    academic_window_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("academic_windows.id"), nullable=True)
    health_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    health_band: Mapped[str] = mapped_column(String(16), nullable=False, default="green")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_program_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("program_instances.id"), nullable=True)
    legacy_interaction_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("university_interactions.id"), nullable=True, unique=True)

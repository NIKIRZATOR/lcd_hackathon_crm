from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import (
    Base,
    ModelBase,
    TimestampCreateMixin,
    TimestampSoftDeleteMixin,
    UUIDPrimaryKeyMixin,
)


class WorkflowTemplate(ModelBase):
    __tablename__ = "workflow_templates"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )


class WorkflowVersion(ModelBase):
    __tablename__ = "workflow_versions"
    __table_args__ = (
        UniqueConstraint("workflow_template_id", "version", name="uq_workflow_versions_template_version"),
        Index("ix_workflow_versions_template_status", "workflow_template_id", "status"),
    )

    workflow_template_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_templates.id"),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="DRAFT")
    supersedes_version_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_versions.id"),
        nullable=True,
    )
    created_by: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WorkflowStage(ModelBase):
    __tablename__ = "workflow_stages"
    __table_args__ = (Index("ix_workflow_stages_version_order", "workflow_version_id", "order_index"),)

    workflow_template_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_templates.id"),
        nullable=False,
    )
    workflow_version_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_versions.id"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    is_initial: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_final: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_optional: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requires_comment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    requires_attachment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class WorkflowTransition(ModelBase):
    __tablename__ = "workflow_transitions"
    __table_args__ = (Index("ix_workflow_transitions_version_from", "workflow_version_id", "from_stage_id"),)

    workflow_template_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_templates.id"),
        nullable=False,
    )
    workflow_version_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_versions.id"),
        nullable=False,
    )
    from_stage_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_stages.id"),
        nullable=False,
    )
    to_stage_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_stages.id"),
        nullable=False,
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    condition_code: Mapped[str | None] = mapped_column(String(255), nullable=True)


class WorkflowStageInstance(ModelBase):
    __tablename__ = "workflow_stage_instances"

    interaction_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("university_interactions.id"),
        nullable=False,
    )
    workflow_stage_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_stages.id"),
        nullable=False,
    )
    responsible_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="NOT_STARTED")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    skipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WorkflowTransitionHistory(ModelBase):
    __tablename__ = "workflow_transition_history"

    interaction_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("university_interactions.id"),
        nullable=False,
    )
    from_stage_instance_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_stage_instances.id"),
        nullable=True,
    )
    to_stage_instance_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_stage_instances.id"),
        nullable=True,
    )
    transition_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_transitions.id"),
        nullable=True,
    )
    performed_by: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WorkflowStageComment(UUIDPrimaryKeyMixin, TimestampSoftDeleteMixin, Base):
    __tablename__ = "workflow_stage_comments"

    stage_instance_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_stage_instances.id"),
        nullable=False,
    )
    author_user_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)


class WorkflowStageAttachment(UUIDPrimaryKeyMixin, TimestampCreateMixin, Base):
    __tablename__ = "workflow_stage_attachments"

    stage_instance_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_stage_instances.id"),
        nullable=False,
    )
    file_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=False,
    )
    uploaded_by: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

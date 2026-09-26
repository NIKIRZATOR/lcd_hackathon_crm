from datetime import date, datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import ModelBase


class ProgramMetric(ModelBase):
    __tablename__ = "program_metrics"
    __table_args__ = (UniqueConstraint("program_instance_id", name="uq_program_metrics_program"),)

    program_instance_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("program_instances.id"), nullable=False
    )
    applications_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    students_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    streams_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    teacher_activity_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IntegrationSignal(ModelBase):
    __tablename__ = "integration_signals"
    __table_args__ = (
        CheckConstraint(
            "status IN ('mapped', 'unmatched', 'error')",
            name="integration_signal_status",
        ),
        Index("ix_integration_signals_program", "program_instance_id"),
        Index("ix_integration_signals_status", "status"),
        Index("ix_integration_signals_source_status_created", "source", "status", "created_at"),
    )

    source: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True
    )
    program_instance_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("program_instances.id"), nullable=True
    )
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

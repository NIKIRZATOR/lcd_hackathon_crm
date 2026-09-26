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
    payment_records_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    teacher_activity_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_website_signal_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_payment_signal_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_lms_signal_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IntegrationSignal(ModelBase):
    __tablename__ = "integration_signals"
    __table_args__ = (
        CheckConstraint(
            "status IN ('received', 'mapped', 'unmatched', 'error', 'ignored')",
            name="integration_signal_status",
        ),
        Index("ix_integration_signals_program", "program_instance_id"),
        Index("ix_integration_signals_status", "status"),
        Index("ix_integration_signals_source_status_created", "source", "status", "created_at"),
        UniqueConstraint("source", "external_key", name="uq_integration_signals_source_external_key"),
    )

    source: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    external_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now().astimezone()
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True
    )
    program_instance_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("program_instances.id"), nullable=True
    )
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    normalized_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    match_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)


class ExternalCourseMapping(ModelBase):
    __tablename__ = "external_course_mappings"
    __table_args__ = (UniqueConstraint("source", "external_course_name", name="uq_external_course_mapping_source_name"),)

    source: Mapped[str] = mapped_column(String(32), nullable=False)
    external_course_name: Mapped[str] = mapped_column(String(512), nullable=False)
    direction_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("it_directions.id"), nullable=True)
    product_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("it_products.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")


class ExternalStreamMapping(ModelBase):
    __tablename__ = "external_stream_mappings"
    __table_args__ = (UniqueConstraint("source", "external_course_name", "external_stream_id", name="uq_external_stream_mapping_key"),)

    source: Mapped[str] = mapped_column(String(32), nullable=False)
    external_course_name: Mapped[str] = mapped_column(String(512), nullable=False)
    external_stream_id: Mapped[str] = mapped_column(String(128), nullable=False)
    program_instance_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("program_instances.id"), nullable=False)

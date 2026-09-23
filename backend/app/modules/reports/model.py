from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import ModelBase


class ReportJob(ModelBase):
    __tablename__ = "report_jobs"
    __table_args__ = (
        Index("ix_report_jobs_status_created_at", "status", "created_at"),
        Index("ix_report_jobs_created_by", "created_by"),
    )

    status: Mapped[str] = mapped_column(String(32), nullable=False, default="QUEUED")
    format: Mapped[str] = mapped_column(String(16), nullable=False)
    filter_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    columns_snapshot: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    created_by: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(128), nullable=True)


class ReportArtifact(ModelBase):
    __tablename__ = "report_artifacts"
    __table_args__ = (
        Index("ix_report_artifacts_job_type", "report_job_id", "artifact_type"),
        Index("ix_report_artifacts_file", "file_id"),
    )

    report_job_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("report_jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("files.id"), nullable=False)
    artifact_type: Mapped[str] = mapped_column(String(32), nullable=False)
    format: Mapped[str] = mapped_column(String(16), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

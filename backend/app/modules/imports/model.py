from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import ModelBase


class ImportJob(ModelBase):
    __tablename__ = "import_jobs"
    __table_args__ = (
        Index("ix_import_jobs_status_created_at", "status", "created_at"),
        Index("ix_import_jobs_created_by", "created_by"),
    )

    status: Mapped[str] = mapped_column(String(32), nullable=False, default="UPLOADED")
    source_file_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=True,
    )
    created_by: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sheet_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    header_row: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    mapping_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("import_mappings.id"),
        nullable=True,
    )
    mapping_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    diff_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    invalid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    create_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    update_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skip_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    conflict_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class ImportArtifact(ModelBase):
    __tablename__ = "import_artifacts"
    __table_args__ = (
        UniqueConstraint("import_job_id", "file_id", "artifact_type", name="uq_import_artifacts_job_file_type"),
        Index("ix_import_artifacts_job_type", "import_job_id", "artifact_type"),
    )

    import_job_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("import_jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("files.id"), nullable=False)
    artifact_type: Mapped[str] = mapped_column(String(32), nullable=False)


class ImportMapping(ModelBase):
    __tablename__ = "import_mappings"
    __table_args__ = (UniqueConstraint("name", name="uq_import_mappings_name"),)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class ImportMappingField(ModelBase):
    __tablename__ = "import_mapping_fields"
    __table_args__ = (
        UniqueConstraint("mapping_id", "source_column", name="uq_import_mapping_fields_source"),
        UniqueConstraint("mapping_id", "target_field", name="uq_import_mapping_fields_target"),
    )

    mapping_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("import_mappings.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_column: Mapped[str] = mapped_column(String(255), nullable=False)
    target_field: Mapped[str] = mapped_column(String(128), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    transformer: Mapped[str | None] = mapped_column(String(128), nullable=True)


class ImportRowError(ModelBase):
    __tablename__ = "import_row_errors"
    __table_args__ = (Index("ix_import_row_errors_job_row", "import_job_id", "row_number"),)

    import_job_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("import_jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    column_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    target_field: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_code: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    raw_fragment: Mapped[str | None] = mapped_column(String(512), nullable=True)

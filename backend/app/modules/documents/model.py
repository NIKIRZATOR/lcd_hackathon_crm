from uuid import UUID

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, ModelBase, TimestampCreateMixin, UUIDPrimaryKeyMixin


class File(UUIDPrimaryKeyMixin, TimestampCreateMixin, Base):
    __tablename__ = "files"
    __table_args__ = (
        UniqueConstraint("provider", "bucket", "object_key", name="uq_files_provider_bucket_object_key"),
        Index("ix_files_cleanup_state", "deleted_at", "delete_after", "purged_at"),
    )

    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extension: Mapped[str | None] = mapped_column(String(32), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    bucket: Mapped[str | None] = mapped_column(String(255), nullable=True)
    object_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    attachment_kind: Mapped[str | None] = mapped_column(String(64), nullable=True)
    uploaded_by: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    scan_status: Mapped[str] = mapped_column(String(32), nullable=False, default="NOT_SCANNED")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delete_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DocumentTemplate(ModelBase):
    __tablename__ = "document_templates"
    __table_args__ = (
        CheckConstraint(
            "file_id IS NOT NULL OR external_url IS NOT NULL",
            name="document_template_source_required",
        ),
    )

    kind: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("files.id"), nullable=True
    )
    external_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

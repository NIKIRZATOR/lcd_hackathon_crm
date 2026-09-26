from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import ModelBase


class DocumentationPage(ModelBase):
    __tablename__ = "documentation_pages"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_documentation_pages_slug"),
        Index("ix_documentation_pages_route", "route_pattern"),
    )

    slug: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    route_pattern: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("documentation_pages.id"), nullable=True)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_file_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("files.id"), nullable=True)


class DocumentationRequest(ModelBase):
    __tablename__ = "documentation_requests"
    __table_args__ = (Index("ix_documentation_requests_status_created", "status", "created_at"),)

    page_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("documentation_pages.id"), nullable=True)
    author_user_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")


class DocumentationImage(ModelBase):
    __tablename__ = "documentation_images"
    __table_args__ = (UniqueConstraint("file_id", name="uq_documentation_images_file"),)

    page_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("documentation_pages.id", ondelete="CASCADE"), nullable=False)
    file_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("files.id"), nullable=False)

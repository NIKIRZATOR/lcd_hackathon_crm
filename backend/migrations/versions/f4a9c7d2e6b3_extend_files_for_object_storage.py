"""extend files for object storage lifecycle

Revision ID: f4a9c7d2e6b3
Revises: e8f2a4c6d9b1
Create Date: 2026-09-22 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "f4a9c7d2e6b3"
down_revision: str | None = "e8f2a4c6d9b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("files", sa.Column("provider", sa.String(length=32), nullable=True))
    op.add_column("files", sa.Column("bucket", sa.String(length=255), nullable=True))
    op.add_column("files", sa.Column("object_key", sa.String(length=1024), nullable=True))
    op.add_column(
        "files",
        sa.Column("scan_status", sa.String(length=32), server_default="NOT_SCANNED", nullable=False),
    )
    op.add_column("files", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("files", sa.Column("delete_after", sa.DateTime(timezone=True), nullable=True))
    op.add_column("files", sa.Column("deleted_by", sa.UUID(), nullable=True))
    op.add_column("files", sa.Column("purged_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        op.f("fk_files_deleted_by_users"),
        "files",
        "users",
        ["deleted_by"],
        ["id"],
    )
    op.create_unique_constraint(
        "uq_files_provider_bucket_object_key",
        "files",
        ["provider", "bucket", "object_key"],
    )
    op.create_index(
        "ix_files_cleanup_state",
        "files",
        ["deleted_at", "delete_after", "purged_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_files_cleanup_state", table_name="files")
    op.drop_constraint("uq_files_provider_bucket_object_key", "files", type_="unique")
    op.drop_constraint(op.f("fk_files_deleted_by_users"), "files", type_="foreignkey")
    op.drop_column("files", "purged_at")
    op.drop_column("files", "deleted_by")
    op.drop_column("files", "delete_after")
    op.drop_column("files", "deleted_at")
    op.drop_column("files", "scan_status")
    op.drop_column("files", "object_key")
    op.drop_column("files", "bucket")
    op.drop_column("files", "provider")

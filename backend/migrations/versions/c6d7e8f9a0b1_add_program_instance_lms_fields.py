"""add LMS synchronization fields to program instances

Revision ID: c6d7e8f9a0b1
Revises: c5d6e7f8a9b0
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c6d7e8f9a0b1"
down_revision: str | None = "c5d6e7f8a9b0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns("program_instances")}
    if "external_lms_id" not in columns:
        op.add_column("program_instances", sa.Column("external_lms_id", sa.String(length=128), nullable=True))
    if "lms_sync_status" not in columns:
        op.add_column("program_instances", sa.Column("lms_sync_status", sa.String(length=16), nullable=True))
    if "last_lms_sync_at" not in columns:
        op.add_column("program_instances", sa.Column("last_lms_sync_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_program_instances_external_lms_id ON program_instances (external_lms_id) WHERE external_lms_id IS NOT NULL")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_program_instances_external_lms_id")
    op.drop_column("program_instances", "last_lms_sync_at")
    op.drop_column("program_instances", "lms_sync_status")
    op.drop_column("program_instances", "external_lms_id")

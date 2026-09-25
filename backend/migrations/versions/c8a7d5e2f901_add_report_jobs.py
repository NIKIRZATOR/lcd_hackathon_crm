"""add report jobs

Revision ID: c8a7d5e2f901
Revises: b7d9a2e1c4f6
Create Date: 2026-09-23 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c8a7d5e2f901"
down_revision: str | None = "b7d9a2e1c4f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "report_jobs",
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("format", sa.String(length=16), nullable=False),
        sa.Column("filter_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("columns_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("error_code", sa.String(length=128), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("request_id", sa.String(length=128), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_report_jobs_created_by_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_report_jobs")),
    )
    op.create_index("ix_report_jobs_created_by", "report_jobs", ["created_by"])
    op.create_index("ix_report_jobs_status_created_at", "report_jobs", ["status", "created_at"])

    op.create_table(
        "report_artifacts",
        sa.Column("report_job_id", sa.UUID(), nullable=False),
        sa.Column("file_id", sa.UUID(), nullable=False),
        sa.Column("artifact_type", sa.String(length=32), nullable=False),
        sa.Column("format", sa.String(length=16), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], name=op.f("fk_report_artifacts_file_id_files")),
        sa.ForeignKeyConstraint(
            ["report_job_id"],
            ["report_jobs.id"],
            name=op.f("fk_report_artifacts_report_job_id_report_jobs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_report_artifacts")),
    )
    op.create_index("ix_report_artifacts_file", "report_artifacts", ["file_id"])
    op.create_index("ix_report_artifacts_job_type", "report_artifacts", ["report_job_id", "artifact_type"])


def downgrade() -> None:
    op.drop_index("ix_report_artifacts_job_type", table_name="report_artifacts")
    op.drop_index("ix_report_artifacts_file", table_name="report_artifacts")
    op.drop_table("report_artifacts")
    op.drop_index("ix_report_jobs_status_created_at", table_name="report_jobs")
    op.drop_index("ix_report_jobs_created_by", table_name="report_jobs")
    op.drop_table("report_jobs")

"""add import jobs

Revision ID: a6e4c2f8b9d0
Revises: f4a9c7d2e6b3
Create Date: 2026-09-23 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a6e4c2f8b9d0"
down_revision: str | None = "f4a9c7d2e6b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "import_mappings",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_import_mappings_created_by_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_import_mappings")),
        sa.UniqueConstraint("name", name="uq_import_mappings_name"),
    )
    op.create_table(
        "import_jobs",
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("source_file_id", sa.UUID(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("sheet_name", sa.String(length=255), nullable=True),
        sa.Column("header_row", sa.Integer(), nullable=False),
        sa.Column("mapping_id", sa.UUID(), nullable=True),
        sa.Column("mapping_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("diff_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("total_rows", sa.Integer(), nullable=False),
        sa.Column("valid_rows", sa.Integer(), nullable=False),
        sa.Column("invalid_rows", sa.Integer(), nullable=False),
        sa.Column("create_count", sa.Integer(), nullable=False),
        sa.Column("update_count", sa.Integer(), nullable=False),
        sa.Column("skip_count", sa.Integer(), nullable=False),
        sa.Column("conflict_count", sa.Integer(), nullable=False),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_import_jobs_created_by_users")),
        sa.ForeignKeyConstraint(["mapping_id"], ["import_mappings.id"], name=op.f("fk_import_jobs_mapping_id_import_mappings")),
        sa.ForeignKeyConstraint(["source_file_id"], ["files.id"], name=op.f("fk_import_jobs_source_file_id_files")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_import_jobs")),
    )
    op.create_index("ix_import_jobs_created_by", "import_jobs", ["created_by"])
    op.create_index("ix_import_jobs_status_created_at", "import_jobs", ["status", "created_at"])
    op.create_table(
        "import_artifacts",
        sa.Column("import_job_id", sa.UUID(), nullable=False),
        sa.Column("file_id", sa.UUID(), nullable=False),
        sa.Column("artifact_type", sa.String(length=32), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], name=op.f("fk_import_artifacts_file_id_files")),
        sa.ForeignKeyConstraint(
            ["import_job_id"],
            ["import_jobs.id"],
            name=op.f("fk_import_artifacts_import_job_id_import_jobs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_import_artifacts")),
        sa.UniqueConstraint("import_job_id", "file_id", "artifact_type", name="uq_import_artifacts_job_file_type"),
    )
    op.create_index("ix_import_artifacts_job_type", "import_artifacts", ["import_job_id", "artifact_type"])
    op.create_table(
        "import_mapping_fields",
        sa.Column("mapping_id", sa.UUID(), nullable=False),
        sa.Column("source_column", sa.String(length=255), nullable=False),
        sa.Column("target_field", sa.String(length=128), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False),
        sa.Column("transformer", sa.String(length=128), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["mapping_id"],
            ["import_mappings.id"],
            name=op.f("fk_import_mapping_fields_mapping_id_import_mappings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_import_mapping_fields")),
        sa.UniqueConstraint("mapping_id", "source_column", name="uq_import_mapping_fields_source"),
        sa.UniqueConstraint("mapping_id", "target_field", name="uq_import_mapping_fields_target"),
    )
    op.create_table(
        "import_row_errors",
        sa.Column("import_job_id", sa.UUID(), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("column_name", sa.String(length=255), nullable=True),
        sa.Column("target_field", sa.String(length=128), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("raw_fragment", sa.String(length=512), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["import_job_id"],
            ["import_jobs.id"],
            name=op.f("fk_import_row_errors_import_job_id_import_jobs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_import_row_errors")),
    )
    op.create_index("ix_import_row_errors_job_row", "import_row_errors", ["import_job_id", "row_number"])


def downgrade() -> None:
    op.drop_index("ix_import_row_errors_job_row", table_name="import_row_errors")
    op.drop_table("import_row_errors")
    op.drop_table("import_mapping_fields")
    op.drop_index("ix_import_artifacts_job_type", table_name="import_artifacts")
    op.drop_table("import_artifacts")
    op.drop_index("ix_import_jobs_status_created_at", table_name="import_jobs")
    op.drop_index("ix_import_jobs_created_by", table_name="import_jobs")
    op.drop_table("import_jobs")
    op.drop_table("import_mappings")

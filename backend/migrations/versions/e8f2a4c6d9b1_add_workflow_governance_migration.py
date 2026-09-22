"""add workflow governance and migration tables

Revision ID: e8f2a4c6d9b1
Revises: d7c1b2a9e8f0
Create Date: 2026-09-22 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e8f2a4c6d9b1"
down_revision: str | None = "d7c1b2a9e8f0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workflow_change_requests",
        sa.Column("workflow_version_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("requested_by", sa.UUID(), nullable=False),
        sa.Column("reviewed_by", sa.UUID(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("review_comment", sa.Text(), nullable=True),
        sa.Column("dangerous_changes_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["requested_by"],
            ["users.id"],
            name=op.f("fk_workflow_change_requests_requested_by_users"),
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
            name=op.f("fk_workflow_change_requests_reviewed_by_users"),
        ),
        sa.ForeignKeyConstraint(
            ["workflow_version_id"],
            ["workflow_versions.id"],
            name=op.f("fk_workflow_change_requests_workflow_version_id_workflow_versions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workflow_change_requests")),
    )
    op.create_index(
        "ix_workflow_change_requests_version_status",
        "workflow_change_requests",
        ["workflow_version_id", "status"],
    )

    op.create_table(
        "workflow_stage_mappings",
        sa.Column("source_version_id", sa.UUID(), nullable=False),
        sa.Column("target_version_id", sa.UUID(), nullable=False),
        sa.Column("source_stage_id", sa.UUID(), nullable=False),
        sa.Column("target_stage_id", sa.UUID(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_workflow_stage_mappings_created_by_users")),
        sa.ForeignKeyConstraint(
            ["source_stage_id"],
            ["workflow_stages.id"],
            name=op.f("fk_workflow_stage_mappings_source_stage_id_workflow_stages"),
        ),
        sa.ForeignKeyConstraint(
            ["source_version_id"],
            ["workflow_versions.id"],
            name=op.f("fk_workflow_stage_mappings_source_version_id_workflow_versions"),
        ),
        sa.ForeignKeyConstraint(
            ["target_stage_id"],
            ["workflow_stages.id"],
            name=op.f("fk_workflow_stage_mappings_target_stage_id_workflow_stages"),
        ),
        sa.ForeignKeyConstraint(
            ["target_version_id"],
            ["workflow_versions.id"],
            name=op.f("fk_workflow_stage_mappings_target_version_id_workflow_versions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workflow_stage_mappings")),
        sa.UniqueConstraint(
            "source_version_id",
            "target_version_id",
            "source_stage_id",
            name="uq_workflow_stage_mappings_source_target_stage",
        ),
    )
    op.create_index(
        "ix_workflow_stage_mappings_versions",
        "workflow_stage_mappings",
        ["source_version_id", "target_version_id"],
    )

    op.create_table(
        "workflow_migration_jobs",
        sa.Column("source_version_id", sa.UUID(), nullable=False),
        sa.Column("target_version_id", sa.UUID(), nullable=False),
        sa.Column("change_request_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("affected_interaction_count", sa.Integer(), nullable=False),
        sa.Column("migrated_interaction_count", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["change_request_id"],
            ["workflow_change_requests.id"],
            name=op.f("fk_workflow_migration_jobs_change_request_id_workflow_change_requests"),
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_workflow_migration_jobs_created_by_users")),
        sa.ForeignKeyConstraint(
            ["source_version_id"],
            ["workflow_versions.id"],
            name=op.f("fk_workflow_migration_jobs_source_version_id_workflow_versions"),
        ),
        sa.ForeignKeyConstraint(
            ["target_version_id"],
            ["workflow_versions.id"],
            name=op.f("fk_workflow_migration_jobs_target_version_id_workflow_versions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workflow_migration_jobs")),
    )
    op.create_index(
        "ix_workflow_migration_jobs_versions",
        "workflow_migration_jobs",
        ["source_version_id", "target_version_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_workflow_migration_jobs_versions", table_name="workflow_migration_jobs")
    op.drop_table("workflow_migration_jobs")
    op.drop_index("ix_workflow_stage_mappings_versions", table_name="workflow_stage_mappings")
    op.drop_table("workflow_stage_mappings")
    op.drop_index("ix_workflow_change_requests_version_status", table_name="workflow_change_requests")
    op.drop_table("workflow_change_requests")

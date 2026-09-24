"""stage 11 program metrics and integration signals

Revision ID: 9b6f3a1e7d50
Revises: 8a5e2d7f3c10
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "9b6f3a1e7d50"
down_revision: str | None = "8a5e2d7f3c10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "program_metrics",
        sa.Column("program_instance_id", sa.UUID(), nullable=False),
        sa.Column("applications_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("students_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("streams_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("teacher_activity_on", sa.Date(), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["program_instance_id"], ["program_instances.id"], name=op.f("fk_program_metrics_program_instance_id_program_instances")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_program_metrics")),
        sa.UniqueConstraint("program_instance_id", name=op.f("uq_program_metrics_program")),
    )
    op.create_table(
        "integration_signals",
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=True),
        sa.Column("program_instance_id", sa.UUID(), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('mapped', 'unmatched', 'error')", name=op.f("ck_integration_signals_integration_signal_status")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_integration_signals_organization_id_organizations")),
        sa.ForeignKeyConstraint(["program_instance_id"], ["program_instances.id"], name=op.f("fk_integration_signals_program_instance_id_program_instances")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_integration_signals")),
    )
    op.create_index("ix_integration_signals_program", "integration_signals", ["program_instance_id"])
    op.create_index("ix_integration_signals_status", "integration_signals", ["status"])


def downgrade() -> None:
    op.drop_index("ix_integration_signals_status", table_name="integration_signals")
    op.drop_index("ix_integration_signals_program", table_name="integration_signals")
    op.drop_table("integration_signals")
    op.drop_table("program_metrics")

"""add program workflow control state

Revision ID: ab2c3d4e5f6a
Revises: aa1b2c3d4e5f
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "ab2c3d4e5f6a"
down_revision = "aa1b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "program_workflow_controls",
        sa.Column("program_instance_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('active', 'frozen')", name="ck_program_workflow_controls_status"),
        sa.ForeignKeyConstraint(["program_instance_id"], ["program_instances.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("program_instance_id", name="uq_program_workflow_control_program"),
    )


def downgrade() -> None:
    op.drop_table("program_workflow_controls")

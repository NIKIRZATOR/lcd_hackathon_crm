"""add persisted workflow stage data and checklist extras

Revision ID: aa1b2c3d4e5f
Revises: d8e9f0a1b2c3
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "aa1b2c3d4e5f"
down_revision = "d8e9f0a1b2c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    stakeholder_columns = {column["name"] for column in inspector.get_columns("stakeholders")}
    if "contact_source" not in stakeholder_columns:
        op.add_column("stakeholders", sa.Column("contact_source", sa.String(length=32), nullable=True))
    stakeholder_checks = {
        constraint["name"] for constraint in inspector.get_check_constraints("stakeholders")
    }
    if "ck_stakeholders_contact_source" not in stakeholder_checks:
        op.create_check_constraint(
            "ck_stakeholders_contact_source",
            "stakeholders",
            "contact_source IS NULL OR contact_source IN ('university_card', 'call', 'email', 'site', 'event', 'referral', 'other')",
        )
    op.create_table(
        "workflow_stage_data",
        sa.Column("stage_instance_id", sa.UUID(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["stage_instance_id"], ["workflow_stage_instances.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stage_instance_id", name="uq_workflow_stage_data_instance"),
    )
    op.create_table(
        "workflow_checklist_extras",
        sa.Column("stage_instance_id", sa.UUID(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("is_done", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["stage_instance_id"], ["workflow_stage_instances.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflow_checklist_extras_stage", "workflow_checklist_extras", ["stage_instance_id"])


def downgrade() -> None:
    op.drop_index("ix_workflow_checklist_extras_stage", table_name="workflow_checklist_extras")
    op.drop_table("workflow_checklist_extras")
    op.drop_table("workflow_stage_data")
    inspector = sa.inspect(op.get_bind())
    stakeholder_checks = {
        constraint["name"] for constraint in inspector.get_check_constraints("stakeholders")
    }
    if "ck_stakeholders_contact_source" in stakeholder_checks:
        op.drop_constraint("ck_stakeholders_contact_source", "stakeholders", type_="check")
    stakeholder_columns = {column["name"] for column in inspector.get_columns("stakeholders")}
    if "contact_source" in stakeholder_columns:
        op.drop_column("stakeholders", "contact_source")

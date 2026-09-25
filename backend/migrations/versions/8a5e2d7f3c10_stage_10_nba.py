"""stage 10 NBA rules and items

Revision ID: 8a5e2d7f3c10
Revises: 7d3f1a9c2e40
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "8a5e2d7f3c10"
down_revision: str | None = "7d3f1a9c2e40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("nba_items"):
        return
    op.create_table(
        "nba_rules",
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_nba_rules")),
        sa.UniqueConstraint("code", name=op.f("uq_nba_rules_code")),
    )
    op.create_table(
        "nba_items",
        sa.Column("rule_id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("program_instance_id", sa.UUID(), nullable=True),
        sa.Column("product_id", sa.UUID(), nullable=True),
        sa.Column("entity_key", sa.String(length=128), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("action", sa.String(length=255), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("severity IN ('critical', 'high', 'medium', 'low')", name=op.f("ck_nba_items_nba_item_severity")),
        sa.CheckConstraint("status IN ('active', 'resolved', 'dismissed')", name=op.f("ck_nba_items_nba_item_status")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_nba_items_organization_id_organizations")),
        sa.ForeignKeyConstraint(["product_id"], ["it_products.id"], name=op.f("fk_nba_items_product_id_it_products")),
        sa.ForeignKeyConstraint(["program_instance_id"], ["program_instances.id"], name=op.f("fk_nba_items_program_instance_id_program_instances")),
        sa.ForeignKeyConstraint(["rule_id"], ["nba_rules.id"], name=op.f("fk_nba_items_rule_id_nba_rules")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_nba_items")),
        sa.UniqueConstraint("rule_id", "entity_key", name=op.f("uq_nba_items_rule_entity")),
    )
    op.create_index("ix_nba_items_status_due", "nba_items", ["status", "due_at"])
    op.create_index("ix_nba_items_program", "nba_items", ["program_instance_id"])


def downgrade() -> None:
    op.drop_index("ix_nba_items_program", table_name="nba_items")
    op.drop_index("ix_nba_items_status_due", table_name="nba_items")
    op.drop_table("nba_items")
    op.drop_table("nba_rules")

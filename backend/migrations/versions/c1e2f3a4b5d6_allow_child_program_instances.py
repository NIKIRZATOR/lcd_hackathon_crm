"""allow renewal and teacher-replacement child programs

Revision ID: c1e2f3a4b5d6
Revises: b4d6f8a0c2e1
"""

from collections.abc import Sequence

from alembic import op


revision: str = "c1e2f3a4b5d6"
down_revision: str | None = "b4d6f8a0c2e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("uq_program_instances_active_scope", table_name="program_instances")
    op.create_index(
        "uq_program_instances_active_scope",
        "program_instances",
        ["organization_id", "direction_id", "product_id"],
        unique=True,
        postgresql_where="status IN ('draft', 'active', 'paused') AND parent_program_id IS NULL",
    )
    op.execute(
        "UPDATE workflow_templates "
        "SET is_active = FALSE, status = 'archived' "
        "WHERE code IN ('materials_update', 'reactivation')"
    )


def downgrade() -> None:
    op.drop_index("uq_program_instances_active_scope", table_name="program_instances")
    op.create_index(
        "uq_program_instances_active_scope",
        "program_instances",
        ["organization_id", "direction_id", "product_id"],
        unique=True,
        postgresql_where="status IN ('draft', 'active', 'paused')",
    )

"""stage 2 typed checklist

Revision ID: b4d6f8a0c2e1
Revises: a2c4e6f8b0d1
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b4d6f8a0c2e1"
down_revision: str | None = "a2c4e6f8b0d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns(table_name)}
    if column.name not in columns:
        op.add_column(table_name, column)


def upgrade() -> None:
    _add_column_if_missing(
        "workflow_stages",
        sa.Column("semester_critical", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    _add_column_if_missing(
        "playbook_checklist_items",
        sa.Column("required_stakeholder_role", sa.String(length=32), nullable=True),
    )
    _add_column_if_missing("program_checklist_values", sa.Column("value_number", sa.Numeric(), nullable=True))
    _add_column_if_missing("program_checklist_values", sa.Column("value_date", sa.Date(), nullable=True))
    _add_column_if_missing(
        "program_checklist_values",
        sa.Column("stakeholder_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    _add_column_if_missing(
        "program_checklist_values",
        sa.Column("attachment_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    foreign_key_columns = {
        tuple(item["constrained_columns"])
        for item in sa.inspect(op.get_bind()).get_foreign_keys("program_checklist_values")
    }
    if ("stakeholder_id",) not in foreign_key_columns:
        op.create_foreign_key(
            "fk_program_checklist_values_stakeholder",
            "program_checklist_values",
            "stakeholders",
            ["stakeholder_id"],
            ["id"],
        )
    if ("attachment_id",) not in foreign_key_columns:
        op.create_foreign_key(
            "fk_program_checklist_values_attachment",
            "program_checklist_values",
            "files",
            ["attachment_id"],
            ["id"],
        )


def downgrade() -> None:
    foreign_keys = sa.inspect(op.get_bind()).get_foreign_keys("program_checklist_values")
    for item in foreign_keys:
        if tuple(item["constrained_columns"]) in {("attachment_id",), ("stakeholder_id",)}:
            op.drop_constraint(item["name"], "program_checklist_values", type_="foreignkey")
    op.drop_column("program_checklist_values", "attachment_id")
    op.drop_column("program_checklist_values", "stakeholder_id")
    op.drop_column("program_checklist_values", "value_date")
    op.drop_column("program_checklist_values", "value_number")
    op.drop_column("playbook_checklist_items", "required_stakeholder_role")
    op.drop_column("workflow_stages", "semester_critical")

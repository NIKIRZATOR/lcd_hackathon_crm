"""add priority and action target to NBA items

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "f4a5b6c7d8e9"
down_revision: str | None = "e3f4a5b6c7d8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns(table_name)}
    if column.name not in columns:
        op.add_column(table_name, column)


def upgrade() -> None:
    _add_column_if_missing(
        "nba_items",
        sa.Column("priority", sa.String(length=2), nullable=False, server_default="P4"),
    )
    _add_column_if_missing("nba_items", sa.Column("action_target", sa.String(length=128), nullable=True))
    op.alter_column("nba_items", "priority", server_default=None)

def downgrade() -> None:
    op.drop_column("nba_items", "action_target")
    op.drop_column("nba_items", "priority")

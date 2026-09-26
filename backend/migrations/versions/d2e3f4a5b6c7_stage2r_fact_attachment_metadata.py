"""add Stage 2R fact attachment metadata and product access

Revision ID: d2e3f4a5b6c7
Revises: c1e2f3a4b5d6
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "d2e3f4a5b6c7"
down_revision: str | None = "c1e2f3a4b5d6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns(table_name)}
    if column.name not in columns:
        op.add_column(table_name, column)


def upgrade() -> None:
    _add_column_if_missing(
        "playbook_checklist_items",
        sa.Column("required_attachment_kind", sa.String(length=64), nullable=True),
    )
    _add_column_if_missing("files", sa.Column("attachment_kind", sa.String(length=64), nullable=True))
    _add_column_if_missing("licenses", sa.Column("product_access", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column("licenses", "product_access")
    op.drop_column("files", "attachment_kind")
    op.drop_column("playbook_checklist_items", "required_attachment_kind")

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


def upgrade() -> None:
    op.add_column("playbook_checklist_items", sa.Column("required_attachment_kind", sa.String(length=64), nullable=True))
    op.add_column("files", sa.Column("attachment_kind", sa.String(length=64), nullable=True))
    op.add_column("licenses", sa.Column("product_access", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column("licenses", "product_access")
    op.drop_column("files", "attachment_kind")
    op.drop_column("playbook_checklist_items", "required_attachment_kind")

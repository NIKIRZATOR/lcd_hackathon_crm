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

def upgrade() -> None:
    op.add_column("nba_items", sa.Column("priority", sa.String(length=2), nullable=False, server_default="P4"))
    op.add_column("nba_items", sa.Column("action_target", sa.String(length=128), nullable=True))
    op.alter_column("nba_items", "priority", server_default=None)

def downgrade() -> None:
    op.drop_column("nba_items", "action_target")
    op.drop_column("nba_items", "priority")

"""store workflow editor content

Revision ID: b3c4d5e6f7a8
Revises: f2a3b4c5d6e7
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "b3c4d5e6f7a8"
down_revision: str = "f2a3b4c5d6e7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "workflow_versions",
        sa.Column("editor_content", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("workflow_versions", "editor_content")

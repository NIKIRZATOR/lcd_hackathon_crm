"""merge workflow backend fields and organization logo heads

Revision ID: f2a3b4c5d6e7
Revises: ac3d4e5f6a7b, e1b2c3d4f5a6
"""
from collections.abc import Sequence


revision: str = "f2a3b4c5d6e7"
down_revision: tuple[str, str] = ("ac3d4e5f6a7b", "e1b2c3d4f5a6")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

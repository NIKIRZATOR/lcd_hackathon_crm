"""extend interactions for contracts and assignment

Revision ID: b2d7a89e4c31
Revises: 9c0f4f2a6d1b
Create Date: 2026-09-21 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "b2d7a89e4c31"
down_revision: str | None = "9c0f4f2a6d1b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("university_interactions", "manager_user_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("university_interactions", sa.Column("contract_number", sa.String(length=255), nullable=True))
    op.add_column(
        "university_interactions",
        sa.Column("license_signed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("university_interactions", sa.Column("license_signed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("university_interactions", sa.Column("license_valid_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("university_interactions", sa.Column("transfer_status", sa.String(length=64), nullable=True))
    op.add_column("university_interactions", sa.Column("university_responsibles", sa.Text(), nullable=True))
    op.alter_column("university_interactions", "license_signed", server_default=None)


def downgrade() -> None:
    op.drop_column("university_interactions", "university_responsibles")
    op.drop_column("university_interactions", "transfer_status")
    op.drop_column("university_interactions", "license_valid_until")
    op.drop_column("university_interactions", "license_signed_at")
    op.drop_column("university_interactions", "license_signed")
    op.drop_column("university_interactions", "contract_number")
    op.alter_column("university_interactions", "manager_user_id", existing_type=sa.UUID(), nullable=False)

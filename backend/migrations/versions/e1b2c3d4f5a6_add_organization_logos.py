"""add organization logo file reference

Revision ID: e1b2c3d4f5a6
Revises: d8e9f0a1b2c3
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "e1b2c3d4f5a6"
down_revision: str | None = "d8e9f0a1b2c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("organizations")}
    if "logo_file_id" not in columns:
        op.add_column("organizations", sa.Column("logo_file_id", sa.UUID(), nullable=True))

    has_logo_foreign_key = any(
        foreign_key["constrained_columns"] == ["logo_file_id"]
        and foreign_key["referred_table"] == "files"
        for foreign_key in inspector.get_foreign_keys("organizations")
    )
    if not has_logo_foreign_key:
        op.create_foreign_key(
            "fk_organizations_logo_file_id_files",
            "organizations",
            "files",
            ["logo_file_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    op.drop_constraint("fk_organizations_logo_file_id_files", "organizations", type_="foreignkey")
    op.drop_column("organizations", "logo_file_id")

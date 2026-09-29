"""add user avatar file reference

Revision ID: c5d6e7f8a9b0
Revises: b3c4d5e6f7a8
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "c5d6e7f8a9b0"
down_revision: str | None = "b3c4d5e6f7a8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "avatar_file_id" not in columns:
        op.add_column("users", sa.Column("avatar_file_id", sa.UUID(), nullable=True))
    has_foreign_key = any(
        foreign_key["constrained_columns"] == ["avatar_file_id"]
        and foreign_key["referred_table"] == "files"
        for foreign_key in inspector.get_foreign_keys("users")
    )
    if not has_foreign_key:
        op.create_foreign_key(
            "fk_users_avatar_file_id_files",
            "users",
            "files",
            ["avatar_file_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    op.drop_constraint("fk_users_avatar_file_id_files", "users", type_="foreignkey")
    op.drop_column("users", "avatar_file_id")

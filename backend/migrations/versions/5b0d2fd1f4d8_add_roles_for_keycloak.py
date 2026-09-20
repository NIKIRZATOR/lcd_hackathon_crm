"""add roles for keycloak

Revision ID: 5b0d2fd1f4d8
Revises: cade47f9d409
Create Date: 2026-09-20 00:00:00.000000

"""
from collections.abc import Sequence
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "5b0d2fd1f4d8"
down_revision: str | None = "cade47f9d409"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


roles_table = sa.table(
    "roles",
    sa.column("id", sa.UUID()),
    sa.column("name", sa.String()),
    sa.column("description", sa.String()),
)

user_roles_table = sa.table(
    "user_roles",
    sa.column("user_id", sa.UUID()),
    sa.column("role_id", sa.UUID()),
)


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=255), nullable=True))
    op.create_unique_constraint(op.f("uq_users_username"), "users", ["username"])
    op.create_table(
        "roles",
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roles")),
        sa.UniqueConstraint("name", name=op.f("uq_roles_name")),
    )
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], name=op.f("fk_user_roles_role_id_roles")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_user_roles_user_id_users")),
        sa.PrimaryKeyConstraint("user_id", "role_id", name=op.f("pk_user_roles")),
    )
    op.create_unique_constraint(op.f("uq_users_keycloak_user_id"), "users", ["keycloak_user_id"])

    role_ids = {
        "KAM": uuid4(),
        "MANAGER": uuid4(),
        "ADMIN": uuid4(),
    }
    op.bulk_insert(
        roles_table,
        [
            {"id": role_ids["KAM"], "name": "KAM", "description": "University account manager"},
            {"id": role_ids["MANAGER"], "name": "MANAGER", "description": "Manager lead"},
            {"id": role_ids["ADMIN"], "name": "ADMIN", "description": "Platform administrator"},
        ],
    )

    connection = op.get_bind()
    users = connection.execute(sa.text("select id, role from users")).mappings().all()
    assignments = [
        {"user_id": user["id"], "role_id": role_ids[user["role"]]}
        for user in users
        if user["role"] in role_ids
    ]
    if assignments:
        op.bulk_insert(user_roles_table, assignments)


def downgrade() -> None:
    op.drop_constraint(op.f("uq_users_keycloak_user_id"), "users", type_="unique")
    op.drop_table("user_roles")
    op.drop_table("roles")
    op.drop_constraint(op.f("uq_users_username"), "users", type_="unique")
    op.drop_column("users", "username")

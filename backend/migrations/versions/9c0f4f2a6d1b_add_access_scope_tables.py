"""add access scope tables

Revision ID: 9c0f4f2a6d1b
Revises: 5b0d2fd1f4d8
Create Date: 2026-09-21 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "9c0f4f2a6d1b"
down_revision: str | None = "5b0d2fd1f4d8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "manager_memberships",
        sa.Column("manager_user_id", sa.UUID(), nullable=False),
        sa.Column("kam_user_id", sa.UUID(), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["kam_user_id"], ["users.id"], name=op.f("fk_manager_memberships_kam_user_id_users")),
        sa.ForeignKeyConstraint(
            ["manager_user_id"], ["users.id"], name=op.f("fk_manager_memberships_manager_user_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_manager_memberships")),
        sa.UniqueConstraint("manager_user_id", "kam_user_id", name="uq_manager_memberships_manager_kam"),
    )
    op.create_index(
        "ix_manager_memberships_manager_active",
        "manager_memberships",
        ["manager_user_id", "is_active"],
    )
    op.create_index(
        "ix_manager_memberships_kam_active",
        "manager_memberships",
        ["kam_user_id", "is_active"],
    )

    op.create_table(
        "responsible_assignment_history",
        sa.Column("interaction_id", sa.UUID(), nullable=False),
        sa.Column("old_manager_user_id", sa.UUID(), nullable=True),
        sa.Column("new_manager_user_id", sa.UUID(), nullable=True),
        sa.Column("changed_by_user_id", sa.UUID(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["changed_by_user_id"], ["users.id"], name=op.f("fk_responsible_assignment_history_changed_by_user_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["interaction_id"],
            ["university_interactions.id"],
            name=op.f("fk_responsible_assignment_history_interaction_id_university_interactions"),
        ),
        sa.ForeignKeyConstraint(
            ["new_manager_user_id"], ["users.id"], name=op.f("fk_responsible_assignment_history_new_manager_user_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["old_manager_user_id"], ["users.id"], name=op.f("fk_responsible_assignment_history_old_manager_user_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_responsible_assignment_history")),
    )
    op.create_index(
        "ix_responsible_assignment_history_interaction_changed_at",
        "responsible_assignment_history",
        ["interaction_id", "changed_at"],
    )

    op.create_table(
        "data_access_scopes",
        sa.Column("subject_user_id", sa.UUID(), nullable=False),
        sa.Column("university_id", sa.UUID(), nullable=True),
        sa.Column("interaction_id", sa.UUID(), nullable=True),
        sa.Column("access_level", sa.String(length=64), nullable=False),
        sa.Column("granted_by_user_id", sa.UUID(), nullable=True),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["granted_by_user_id"], ["users.id"], name=op.f("fk_data_access_scopes_granted_by_user_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["interaction_id"],
            ["university_interactions.id"],
            name=op.f("fk_data_access_scopes_interaction_id_university_interactions"),
        ),
        sa.ForeignKeyConstraint(
            ["subject_user_id"], ["users.id"], name=op.f("fk_data_access_scopes_subject_user_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["university_id"], ["universities.id"], name=op.f("fk_data_access_scopes_university_id_universities")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_data_access_scopes")),
    )
    op.create_index(
        "ix_data_access_scopes_subject_active",
        "data_access_scopes",
        ["subject_user_id", "is_active"],
    )
    op.create_index(
        "ix_data_access_scopes_university",
        "data_access_scopes",
        ["university_id"],
    )
    op.create_index(
        "ix_data_access_scopes_interaction",
        "data_access_scopes",
        ["interaction_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_data_access_scopes_interaction", table_name="data_access_scopes")
    op.drop_index("ix_data_access_scopes_university", table_name="data_access_scopes")
    op.drop_index("ix_data_access_scopes_subject_active", table_name="data_access_scopes")
    op.drop_table("data_access_scopes")

    op.drop_index("ix_responsible_assignment_history_interaction_changed_at", table_name="responsible_assignment_history")
    op.drop_table("responsible_assignment_history")

    op.drop_index("ix_manager_memberships_kam_active", table_name="manager_memberships")
    op.drop_index("ix_manager_memberships_manager_active", table_name="manager_memberships")
    op.drop_table("manager_memberships")

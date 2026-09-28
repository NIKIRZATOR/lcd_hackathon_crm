"""add workflow document and signing fields

Revision ID: ac3d4e5f6a7b
Revises: ab2c3d4e5f6a
"""

from alembic import op
import sqlalchemy as sa


revision = "ac3d4e5f6a7b"
down_revision = "ab2c3d4e5f6a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contracts", sa.Column("signer", sa.String(length=255), nullable=True))
    op.add_column(
        "licenses", sa.Column("recipient_stakeholder_id", sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        "fk_licenses_recipient_stakeholder_id_stakeholders",
        "licenses",
        "stakeholders",
        ["recipient_stakeholder_id"],
        ["id"],
    )
    op.create_table(
        "document_templates",
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("file_id", sa.UUID(), nullable=True),
        sa.Column("external_url", sa.String(length=1024), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "file_id IS NOT NULL OR external_url IS NOT NULL",
            name="ck_document_templates_document_template_source_required",
        ),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("kind", name="uq_document_templates_kind"),
    )


def downgrade() -> None:
    op.drop_table("document_templates")
    op.drop_constraint(
        "fk_licenses_recipient_stakeholder_id_stakeholders",
        "licenses",
        type_="foreignkey",
    )
    op.drop_column("licenses", "recipient_stakeholder_id")
    op.drop_column("contracts", "signer")

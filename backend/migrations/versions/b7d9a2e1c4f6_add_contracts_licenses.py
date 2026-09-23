"""add normalized contracts and licenses

Revision ID: b7d9a2e1c4f6
Revises: a6e4c2f8b9d0
Create Date: 2026-09-23 00:00:00.000000

"""
from collections.abc import Sequence
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "b7d9a2e1c4f6"
down_revision: str | None = "a6e4c2f8b9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "contracts",
        sa.Column("interaction_id", sa.UUID(), nullable=False),
        sa.Column("number", sa.String(length=255), nullable=False),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["interaction_id"],
            ["university_interactions.id"],
            name=op.f("fk_contracts_interaction_id_university_interactions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contracts")),
        sa.UniqueConstraint("interaction_id", "number", name="uq_contracts_interaction_number"),
    )
    op.create_index("ix_contracts_interaction", "contracts", ["interaction_id"])
    op.create_table(
        "licenses",
        sa.Column("contract_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("license_number", sa.String(length=255), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transfer_status", sa.String(length=64), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["contract_id"],
            ["contracts.id"],
            name=op.f("fk_licenses_contract_id_contracts"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["product_id"], ["it_products.id"], name=op.f("fk_licenses_product_id_it_products")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_licenses")),
        sa.UniqueConstraint("contract_id", "product_id", name="uq_licenses_contract_product"),
    )
    op.create_index("ix_licenses_contract", "licenses", ["contract_id"])
    op.create_index("ix_licenses_product", "licenses", ["product_id"])

    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            """
            SELECT id, product_id, contract_number, license_signed_at, license_valid_until, transfer_status, status
            FROM university_interactions
            WHERE contract_number IS NOT NULL
            """
        )
    ).mappings()
    for row in rows:
        contract_id = uuid4()
        connection.execute(
            sa.text(
                """
                INSERT INTO contracts
                    (id, interaction_id, number, signed_at, valid_from, valid_until, status, created_at, updated_at)
                VALUES
                    (:id, :interaction_id, :number, :signed_at, NULL, :valid_until, :status, now(), now())
                ON CONFLICT (interaction_id, number) DO NOTHING
                """
            ),
            {
                "id": contract_id,
                "interaction_id": row["id"],
                "number": row["contract_number"],
                "signed_at": row["license_signed_at"],
                "valid_until": row["license_valid_until"],
                "status": row["status"],
            },
        )
        existing_contract_id = connection.scalar(
            sa.text(
                """
                SELECT id FROM contracts
                WHERE interaction_id = :interaction_id AND number = :number
                """
            ),
            {"interaction_id": row["id"], "number": row["contract_number"]},
        )
        connection.execute(
            sa.text(
                """
                INSERT INTO licenses
                    (id, contract_id, product_id, license_number, signed_at, valid_until, transfer_status, created_at, updated_at)
                VALUES
                    (:id, :contract_id, :product_id, NULL, :signed_at, :valid_until, :transfer_status, now(), now())
                ON CONFLICT (contract_id, product_id) DO NOTHING
                """
            ),
            {
                "id": uuid4(),
                "contract_id": existing_contract_id,
                "product_id": row["product_id"],
                "signed_at": row["license_signed_at"],
                "valid_until": row["license_valid_until"],
                "transfer_status": row["transfer_status"],
            },
        )


def downgrade() -> None:
    op.drop_index("ix_licenses_product", table_name="licenses")
    op.drop_index("ix_licenses_contract", table_name="licenses")
    op.drop_table("licenses")
    op.drop_index("ix_contracts_interaction", table_name="contracts")
    op.drop_table("contracts")

"""stage 8 contracts, licenses and teacher carriers

Revision ID: 6c1e8a4d9b20
Revises: 4e2cb764e196
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "6c1e8a4d9b20"
down_revision: str | None = "4e2cb764e196"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("teacher_carriers"):
        return
    op.alter_column("contracts", "interaction_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("contracts", sa.Column("organization_id", sa.UUID(), nullable=True))
    op.add_column("contracts", sa.Column("signed_on", sa.Date(), nullable=True))
    op.add_column("contracts", sa.Column("attachment_id", sa.UUID(), nullable=True))
    op.add_column("contracts", sa.Column("comment", sa.Text(), nullable=True))
    op.create_foreign_key(op.f("fk_contracts_organization_id_organizations"), "contracts", "organizations", ["organization_id"], ["id"])
    op.create_foreign_key(op.f("fk_contracts_attachment_id_files"), "contracts", "files", ["attachment_id"], ["id"])
    op.create_index("ix_contracts_organization", "contracts", ["organization_id"])

    op.alter_column("licenses", "contract_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("licenses", sa.Column("program_instance_id", sa.UUID(), nullable=True))
    op.add_column("licenses", sa.Column("transferred_on", sa.Date(), nullable=True))
    op.add_column("licenses", sa.Column("attachment_id", sa.UUID(), nullable=True))
    op.add_column("licenses", sa.Column("comment", sa.Text(), nullable=True))
    op.create_foreign_key(op.f("fk_licenses_program_instance_id_program_instances"), "licenses", "program_instances", ["program_instance_id"], ["id"])
    op.create_foreign_key(op.f("fk_licenses_attachment_id_files"), "licenses", "files", ["attachment_id"], ["id"])
    op.create_index("ix_licenses_program_instance", "licenses", ["program_instance_id"])

    op.create_table(
        "teacher_carriers",
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("program_instance_id", sa.UUID(), nullable=True),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("stakeholder_id", sa.UUID(), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("trained_on", sa.Date(), nullable=True),
        sa.Column("qualification_until", sa.Date(), nullable=True),
        sa.Column("last_lms_activity_on", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('planned', 'trained', 'active', 'expired', 'left')", name=op.f("ck_teacher_carriers_teacher_carrier_status")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_teacher_carriers_organization_id_organizations")),
        sa.ForeignKeyConstraint(["program_instance_id"], ["program_instances.id"], name=op.f("fk_teacher_carriers_program_instance_id_program_instances")),
        sa.ForeignKeyConstraint(["product_id"], ["it_products.id"], name=op.f("fk_teacher_carriers_product_id_it_products")),
        sa.ForeignKeyConstraint(["stakeholder_id"], ["stakeholders.id"], name=op.f("fk_teacher_carriers_stakeholder_id_stakeholders")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_teacher_carriers")),
    )
    op.create_index("ix_teacher_carriers_organization", "teacher_carriers", ["organization_id"])
    op.create_index("ix_teacher_carriers_program_instance", "teacher_carriers", ["program_instance_id"])


def downgrade() -> None:
    op.drop_index("ix_teacher_carriers_program_instance", table_name="teacher_carriers")
    op.drop_index("ix_teacher_carriers_organization", table_name="teacher_carriers")
    op.drop_table("teacher_carriers")
    op.drop_index("ix_licenses_program_instance", table_name="licenses")
    op.drop_constraint(op.f("fk_licenses_attachment_id_files"), "licenses", type_="foreignkey")
    op.drop_constraint(op.f("fk_licenses_program_instance_id_program_instances"), "licenses", type_="foreignkey")
    op.drop_column("licenses", "comment")
    op.drop_column("licenses", "attachment_id")
    op.drop_column("licenses", "transferred_on")
    op.drop_column("licenses", "program_instance_id")
    op.alter_column("licenses", "contract_id", existing_type=sa.UUID(), nullable=False)
    op.drop_index("ix_contracts_organization", table_name="contracts")
    op.drop_constraint(op.f("fk_contracts_attachment_id_files"), "contracts", type_="foreignkey")
    op.drop_constraint(op.f("fk_contracts_organization_id_organizations"), "contracts", type_="foreignkey")
    op.drop_column("contracts", "comment")
    op.drop_column("contracts", "attachment_id")
    op.drop_column("contracts", "signed_on")
    op.drop_column("contracts", "organization_id")
    op.alter_column("contracts", "interaction_id", existing_type=sa.UUID(), nullable=False)

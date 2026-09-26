"""stage 5 fixture integration pipeline

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "d8e9f0a1b2c3"
down_revision: str | None = "c7d8e9f0a1b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_column_if_missing(table: str, column: sa.Column) -> None:
    if column.name not in {item["name"] for item in sa.inspect(op.get_bind()).get_columns(table)}:
        op.add_column(table, column)


def upgrade() -> None:
    _add_column_if_missing("vendors", sa.Column("business_key", sa.String(length=512), nullable=True))
    _add_column_if_missing("it_products", sa.Column("business_key", sa.String(length=768), nullable=True))
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_vendors_business_key ON vendors (business_key) WHERE business_key IS NOT NULL")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_it_products_business_key ON it_products (business_key) WHERE business_key IS NOT NULL")

    op.create_table(
        "vendor_contacts",
        sa.Column("vendor_id", sa.UUID(), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("product_id", sa.UUID(), sa.ForeignKey("it_products.id"), nullable=True),
        sa.Column("business_key", sa.String(length=512), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("preferred_channel", sa.String(length=255), nullable=True),
        sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("vendor_id", "business_key", name="uq_vendor_contacts_vendor_key"),
    )

    _add_column_if_missing("program_metrics", sa.Column("payment_records_count", sa.Integer(), nullable=False, server_default="0"))
    _add_column_if_missing("program_metrics", sa.Column("last_website_signal_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing("program_metrics", sa.Column("last_payment_signal_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing("program_metrics", sa.Column("last_lms_signal_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("program_metrics", "payment_records_count", server_default=None)

    _add_column_if_missing("integration_signals", sa.Column("external_key", sa.String(length=255), nullable=True))
    _add_column_if_missing("integration_signals", sa.Column("received_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")))
    _add_column_if_missing("integration_signals", sa.Column("normalized_payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    _add_column_if_missing("integration_signals", sa.Column("error_code", sa.String(length=64), nullable=True))
    _add_column_if_missing("integration_signals", sa.Column("match_reason", sa.String(length=255), nullable=True))
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_signals_source_external_key ON integration_signals (source, external_key) WHERE external_key IS NOT NULL")
    op.execute("ALTER TABLE integration_signals DROP CONSTRAINT IF EXISTS ck_integration_signals_integration_signal_status")
    op.execute("ALTER TABLE integration_signals ADD CONSTRAINT ck_integration_signals_integration_signal_status CHECK (status IN ('received', 'mapped', 'unmatched', 'error', 'ignored'))")
    op.alter_column("integration_signals", "received_at", server_default=None)
    op.alter_column("integration_signals", "normalized_payload", server_default=None)

    op.create_table(
        "external_course_mappings",
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("external_course_name", sa.String(length=512), nullable=False),
        sa.Column("direction_id", sa.UUID(), sa.ForeignKey("it_directions.id"), nullable=True),
        sa.Column("product_id", sa.UUID(), sa.ForeignKey("it_products.id"), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("source", "external_course_name", name="uq_external_course_mapping_source_name"),
    )
    op.create_table(
        "external_stream_mappings",
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("external_course_name", sa.String(length=512), nullable=False),
        sa.Column("external_stream_id", sa.String(length=128), nullable=False),
        sa.Column("program_instance_id", sa.UUID(), sa.ForeignKey("program_instances.id"), nullable=False),
        sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("source", "external_course_name", "external_stream_id", name="uq_external_stream_mapping_key"),
    )


def downgrade() -> None:
    op.drop_table("external_stream_mappings")
    op.drop_table("external_course_mappings")
    op.drop_index("uq_integration_signals_source_external_key", table_name="integration_signals")
    for column in ("match_reason", "error_code", "normalized_payload", "received_at", "external_key"):
        op.drop_column("integration_signals", column)
    for column in ("last_lms_signal_at", "last_payment_signal_at", "last_website_signal_at", "payment_records_count"):
        op.drop_column("program_metrics", column)
    op.drop_table("vendor_contacts")
    op.execute("DROP INDEX IF EXISTS uq_it_products_business_key")
    op.execute("DROP INDEX IF EXISTS uq_vendors_business_key")
    op.drop_column("it_products", "business_key")
    op.drop_column("vendors", "business_key")

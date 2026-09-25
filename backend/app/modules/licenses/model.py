from datetime import date, datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import ModelBase


class Contract(ModelBase):
    __tablename__ = "contracts"
    __table_args__ = (
        UniqueConstraint("interaction_id", "number", name="uq_contracts_interaction_number"),
        UniqueConstraint("organization_id", "number", name="uq_contracts_organization_number"),
        CheckConstraint(
            "organization_id IS NOT NULL OR interaction_id IS NOT NULL",
            name="contract_owner_required",
        ),
        Index("ix_contracts_interaction", "interaction_id"),
        Index("ix_contracts_organization", "organization_id"),
    )

    # interaction_id is retained only for legacy records. New contracts belong to an organization.
    interaction_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("university_interactions.id", ondelete="CASCADE"),
        nullable=True,
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True
    )
    number: Mapped[str] = mapped_column(String(255), nullable=False)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    signed_on: Mapped[date | None] = mapped_column(nullable=True)
    attachment_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("files.id"), nullable=True)
    comment: Mapped[str | None] = mapped_column(String, nullable=True)


class License(ModelBase):
    __tablename__ = "licenses"
    __table_args__ = (
        UniqueConstraint("contract_id", "product_id", name="uq_licenses_contract_product"),
        CheckConstraint(
            "program_instance_id IS NOT NULL OR contract_id IS NOT NULL",
            name="license_owner_required",
        ),
        Index("ix_licenses_contract", "contract_id"),
        Index("ix_licenses_product", "product_id"),
        Index("ix_licenses_program_instance", "program_instance_id"),
    )

    contract_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("it_products.id"),
        nullable=False,
    )
    license_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    transfer_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    program_instance_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("program_instances.id"), nullable=True
    )
    transferred_on: Mapped[date | None] = mapped_column(nullable=True)
    attachment_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("files.id"), nullable=True)
    comment: Mapped[str | None] = mapped_column(String, nullable=True)

from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import ModelBase


class Vendor(ModelBase):
    __tablename__ = "vendors"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_key: Mapped[str | None] = mapped_column(String(512), nullable=True, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ITProduct(ModelBase):
    __tablename__ = "it_products"

    vendor_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("vendors.id"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_key: Mapped[str | None] = mapped_column(String(768), nullable=True, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    documentation_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class VendorContact(ModelBase):
    __tablename__ = "vendor_contacts"
    __table_args__ = (UniqueConstraint("vendor_id", "business_key", name="uq_vendor_contacts_vendor_key"),)

    vendor_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)
    product_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("it_products.id"), nullable=True)
    business_key: Mapped[str] = mapped_column(String(512), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferred_channel: Mapped[str | None] = mapped_column(String(255), nullable=True)


class ProgramProduct(ModelBase):
    __tablename__ = "program_products"
    __table_args__ = (
        UniqueConstraint("program_id", "product_id", name="uq_program_products_program_product"),
    )

    program_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("it_programs.id"),
        nullable=False,
    )
    product_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("it_products.id"),
        nullable=False,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

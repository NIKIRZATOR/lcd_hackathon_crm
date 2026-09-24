from datetime import date
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import ModelBase


class TeacherCarrier(ModelBase):
    __tablename__ = "teacher_carriers"
    __table_args__ = (
        CheckConstraint("status IN ('planned', 'trained', 'active', 'expired', 'left')", name="teacher_carrier_status"),
    )

    organization_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    program_instance_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("program_instances.id"), nullable=True)
    product_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("it_products.id"), nullable=False)
    stakeholder_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("stakeholders.id"), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    trained_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    qualification_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_lms_activity_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="planned")

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import ModelBase


class UniversityInteraction(ModelBase):
    __tablename__ = "university_interactions"

    university_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("universities.id"),
        nullable=False,
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
    manager_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    workflow_template_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workflow_templates.id"),
        nullable=True,
    )
    current_stage_instance_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey(
            "workflow_stage_instances.id",
            name="fk_university_interactions_current_stage_instance",
            use_alter=True,
        ),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="DRAFT")
    contract_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    license_signed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    license_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    license_valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    transfer_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    university_responsibles: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)


class InteractionContact(ModelBase):
    __tablename__ = "interaction_contacts"
    __table_args__ = (
        UniqueConstraint(
            "interaction_id",
            "contact_id",
            name="uq_interaction_contacts_interaction_contact",
        ),
    )

    interaction_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("university_interactions.id"),
        nullable=False,
    )
    contact_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("university_contacts.id"),
        nullable=False,
    )
    role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

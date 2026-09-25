from uuid import UUID
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import ModelBase

class PlaybookChecklistItem(ModelBase):
    __tablename__ = "playbook_checklist_items"
    __table_args__ = (CheckConstraint("item_type IN ('checkbox','file','date','stakeholder_role','number','text')", name="checklist_item_type"),)
    workflow_stage_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("workflow_stages.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    item_type: Mapped[str] = mapped_column(String(32), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    required_stakeholder_role: Mapped[str | None] = mapped_column(String(32), nullable=True)

class ProgramChecklistValue(ModelBase):
    __tablename__ = "program_checklist_values"
    __table_args__ = (
        UniqueConstraint(
            "stage_instance_id",
            "checklist_item_id",
            name="uq_program_checklist_values_stage_item",
        ),
    )
    checklist_item_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("playbook_checklist_items.id"), nullable=False)
    stage_instance_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("workflow_stage_instances.id"), nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_number: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    value_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    stakeholder_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("stakeholders.id"), nullable=True
    )
    attachment_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("files.id"), nullable=True
    )

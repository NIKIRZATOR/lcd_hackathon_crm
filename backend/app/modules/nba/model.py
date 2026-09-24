from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import ModelBase


class NbaRule(ModelBase):
    __tablename__ = "nba_rules"

    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)


class NbaItem(ModelBase):
    __tablename__ = "nba_items"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('critical', 'high', 'medium', 'low')",
            name="nba_item_severity",
        ),
        CheckConstraint(
            "status IN ('active', 'resolved', 'dismissed')", name="nba_item_status"
        ),
        UniqueConstraint("rule_id", "entity_key", name="uq_nba_items_rule_entity"),
        Index("ix_nba_items_status_due", "status", "due_at"),
        Index("ix_nba_items_program", "program_instance_id"),
    )

    rule_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("nba_rules.id"), nullable=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    program_instance_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("program_instances.id"), nullable=True
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("it_products.id"), nullable=True
    )
    entity_key: Mapped[str] = mapped_column(String(128), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

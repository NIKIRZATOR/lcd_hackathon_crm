from datetime import datetime
from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.audit.model import AuditEvent


class AuditEventRepository:
    sortable_fields = {"created_at", "action", "entity_type", "result"}
    default_sort = "created_at"

    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, event: AuditEvent) -> AuditEvent:
        self.db.add(event)
        self.db.flush()
        return event

    def list(
        self,
        *,
        actor_user_id: UUID | None,
        action: str | None,
        entity_type: str | None,
        entity_id: UUID | None,
        result: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[AuditEvent]:
        statement = select(AuditEvent)
        filters = {
            "actor_user_id": actor_user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "result": result,
        }
        for field, value in filters.items():
            if value is not None:
                statement = statement.where(getattr(AuditEvent, field) == value)
        if date_from is not None:
            statement = statement.where(AuditEvent.created_at >= date_from)
        if date_to is not None:
            statement = statement.where(AuditEvent.created_at <= date_to)

        total = self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0
        order_column = getattr(AuditEvent, self._resolve_sort_field(sort_by))
        order_expression = desc(order_column) if sort_order == "desc" else asc(order_column)
        items = list(self.db.scalars(statement.order_by(order_expression).limit(limit).offset(offset)).all())
        return ListResult(items=items, total=total)

    def _resolve_sort_field(self, sort_by: str | None) -> str:
        if sort_by and sort_by in self.sortable_fields:
            return sort_by
        return self.default_sort

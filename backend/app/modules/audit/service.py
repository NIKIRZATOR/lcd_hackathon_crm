from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository


FILE_AUDIT_ACTIONS = (
    "file.upload",
    "file.download",
    "file.delete",
    "file.scan_status_changed",
    "storage.presign_generated",
)


class AuditService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = AuditEventRepository(db)

    def list_events(
        self,
        *,
        actor_user_id: UUID | None,
        actor_role: str | None,
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
        return self.repository.list(
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            result=result,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def log_event(
        self,
        *,
        actor_user_id: UUID | None,
        action: str,
        entity_type: str,
        entity_id: UUID | None,
        result: str = "SUCCESS",
        reason: str | None = None,
        error_code: str | None = None,
        metadata: dict[str, Any] | None = None,
        request_id: str | None = None,
    ) -> AuditEvent:
        event = AuditEvent(
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            result=result,
            reason=reason,
            error_code=error_code,
            event_metadata=metadata,
            request_id=request_id,
        )
        self.repository.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

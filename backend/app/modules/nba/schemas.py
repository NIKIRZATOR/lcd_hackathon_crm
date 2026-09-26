from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NbaItemRead(BaseModel):
    id: UUID
    rule_code: str
    severity: str
    organization_id: UUID
    organization_name: str
    program_instance_id: UUID | None
    product_name: str | None
    reason: str
    action: str
    priority: str
    action_target: str | None
    due_at: datetime | None

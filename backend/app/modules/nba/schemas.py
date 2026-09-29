from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class NbaChecklistItemRead(BaseModel):
    code: str
    label: str
    required: bool
    is_done: bool
    value_text: str | None = None
    value_date: date | None = None


class NbaContextRead(BaseModel):
    stage_code: str | None = None
    stage_due_at: datetime | None = None
    checklist: list[NbaChecklistItemRead] = Field(default_factory=list)
    attachment_kinds: list[str] = Field(default_factory=list)


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
    context: NbaContextRead | None = None

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(description="Audit event identifier.")
    actor_user_id: UUID | None = Field(default=None, description="User who performed the audited action.")
    action: str = Field(description="Stable action code, for example `interaction.assign`.")
    entity_type: str = Field(description="Audited entity type, for example `interaction`.")
    entity_id: UUID | None = Field(default=None, description="Audited entity identifier when available.")
    result: str = Field(description="Action result, usually `SUCCESS` or `FAILURE`.")
    reason: str | None = Field(default=None, description="Human-readable reason/comment when available.")
    error_code: str | None = Field(default=None, description="Stable error code for failed audited actions.")
    event_metadata: dict[str, Any] | None = Field(
        default=None,
        validation_alias="event_metadata",
        serialization_alias="metadata",
        description="Safe technical metadata without tokens, secrets or excessive personal data.",
    )
    request_id: str | None = Field(default=None, description="Request identifier propagated from `X-Request-ID`.")
    created_at: datetime = Field(description="Audit event creation timestamp.")

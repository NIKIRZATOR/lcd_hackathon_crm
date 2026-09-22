"""Pydantic schemas for contracts and uploaded file metadata."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WorkflowAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    stage_instance_id: UUID
    file_id: UUID
    uploaded_by: UUID
    description: str | None = None
    created_at: datetime
    original_name: str
    mime_type: str | None = None
    extension: str | None = None
    size_bytes: int | None = None
    checksum: str | None = None
    scan_status: str

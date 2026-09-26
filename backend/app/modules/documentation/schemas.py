from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DocumentationPageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    slug: str
    title: str
    route_pattern: str
    parent_id: UUID | None
    sort_order: int
    content_markdown: str
    source_file_id: UUID | None
    updated_at: datetime


class DocumentationPageCreate(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=255)
    route_pattern: str = Field(min_length=1, max_length=255)
    parent_id: UUID | None = None
    sort_order: int = 0
    content_markdown: str = ""


class DocumentationPageUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    route_pattern: str | None = Field(default=None, min_length=1, max_length=255)
    parent_id: UUID | None = None
    sort_order: int | None = None
    content_markdown: str | None = None


class DocumentationImageRead(BaseModel):
    id: UUID
    file_id: UUID
    markdown: str


class DocumentationRequestCreate(BaseModel):
    page_id: UUID | None = None
    subject: str = Field(min_length=3, max_length=255)
    message: str = Field(min_length=3, max_length=10_000)


class DocumentationRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    page_id: UUID | None
    author_user_id: UUID
    author_name: str | None = None
    subject: str
    message: str
    status: str
    created_at: datetime


class DocumentationRequestUpdate(BaseModel):
    status: str = Field(pattern="^(open|closed)$")

"""Pydantic schemas for contracts and uploaded file metadata."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkflowAttachmentRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "c53465f3-56c7-44e1-b602-ed03cd55d3a2",
                "stage_instance_id": "b9a1c2ef-5370-495c-928e-981cfee7a0d0",
                "file_id": "a0aa084e-0980-4fd9-8487-b22fb3e0f388",
                "uploaded_by": "f6d5a31f-2d9f-4d67-852b-d5f6aabd89d5",
                "description": "Signed contract from university",
                "created_at": "2026-09-22T13:10:35.780868Z",
                "original_name": "contract.pdf",
                "mime_type": "application/pdf",
                "extension": "pdf",
                "size_bytes": 1048576,
                "checksum": "39677cb1eb2e037dd2b99a4f2bf444023681b5d770da65790481459714bc6852",
                "scan_status": "NOT_SCANNED",
            }
        },
    )

    id: UUID = Field(description="Идентификатор workflow attachment.")
    stage_instance_id: UUID = Field(description="Workflow stage instance, к которому привязан attachment.")
    file_id: UUID = Field(description="Идентификатор metadata-записи в таблице `files`.")
    uploaded_by: UUID = Field(description="Пользователь, загрузивший attachment.")
    description: str | None = Field(default=None, description="Опциональное бизнес-описание attachment.")
    created_at: datetime = Field(description="Дата и время создания attachment.")
    original_name: str = Field(description="Оригинальное имя файла, полученное от клиента.")
    mime_type: str | None = Field(default=None, description="Проверенный MIME type файла.")
    extension: str | None = Field(default=None, description="Проверенное расширение файла без точки.")
    size_bytes: int | None = Field(default=None, description="Размер файла в байтах.")
    checksum: str | None = Field(default=None, description="SHA-256 checksum загруженного binary content.")
    scan_status: str = Field(description="Статус antivirus scan.")
    attachment_kind: str | None = Field(default=None, description="Business kind of the attachment.")

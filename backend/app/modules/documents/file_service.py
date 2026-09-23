from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.documents.model import File
from app.modules.workflows.model import WorkflowStageAttachment, WorkflowStageInstance
from app.storage import StorageAdapter, get_storage_adapter


ALLOWED_ATTACHMENT_TYPES = {
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".pdf": {"application/pdf"},
    ".zip": {"application/zip", "application/x-zip-compressed"},
    ".gz": {"application/gzip", "application/x-gzip"},
    ".gzip": {"application/gzip", "application/x-gzip"},
    ".rar": {"application/vnd.rar", "application/x-rar-compressed"},
    ".doc": {"application/msword", "application/octet-stream"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".xls": {"application/vnd.ms-excel", "application/octet-stream"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
}
ATTACHMENT_SIGNATURES = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".pdf": (b"%PDF",),
    ".zip": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".docx": (b"PK\x03\x04",),
    ".xlsx": (b"PK\x03\x04",),
    ".gz": (b"\x1f\x8b",),
    ".gzip": (b"\x1f\x8b",),
    ".rar": (b"Rar!\x1a\x07\x00", b"Rar!\x1a\x07\x01\x00"),
    ".doc": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    ".xls": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
}
CHUNK_SIZE = 1024 * 1024


def file_error(
    *,
    status_code: int,
    code: str,
    message: str,
    details: dict | None = None,
) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "details": details},
    )


class FileService:
    def __init__(self, db: Session, storage: StorageAdapter | None = None) -> None:
        self.db = db
        self.storage = storage or get_storage_adapter()
        self.audit_repository = AuditEventRepository(db)

    def upload_workflow_attachment(
        self,
        *,
        stage_instance_id: UUID,
        upload: UploadFile,
        uploaded_by: UUID,
        description: str | None = None,
        request_id: str | None = None,
    ) -> WorkflowStageAttachment:
        instance = self._get_stage_instance(stage_instance_id)
        original_name = Path(upload.filename or "").name
        extension = Path(original_name).suffix.lower()
        self._validate_upload(original_name=original_name, extension=extension, content_type=upload.content_type)

        size_bytes, checksum = self._inspect_upload(upload, extension=extension)
        object_name = f"{uuid4()}{extension}"
        object_key = f"interactions/{instance.interaction_id}/stages/{stage_instance_id}/{object_name}"
        bucket = settings.s3_bucket_workflow_files
        stored = False

        try:
            upload.file.seek(0)
            self.storage.put(
                bucket=bucket,
                object_key=object_key,
                data=upload.file,
                length=size_bytes,
                content_type=upload.content_type,
            )
            stored = True

            file_record = File(
                original_name=original_name,
                storage_name=object_name,
                storage_path=f"{bucket}/{object_key}",
                mime_type=upload.content_type,
                extension=extension.lstrip("."),
                size_bytes=size_bytes,
                checksum=checksum,
                provider="S3",
                bucket=bucket,
                object_key=object_key,
                uploaded_by=uploaded_by,
                scan_status="NOT_SCANNED",
            )
            self.db.add(file_record)
            self.db.flush()

            attachment = WorkflowStageAttachment(
                stage_instance_id=stage_instance_id,
                file_id=file_record.id,
                uploaded_by=uploaded_by,
                description=description,
            )
            self.db.add(attachment)
            self.db.flush()
            self.audit_repository.add(
                AuditEvent(
                    actor_user_id=uploaded_by,
                    action="file.upload",
                    entity_type="file",
                    entity_id=file_record.id,
                    event_metadata={
                        "stage_instance_id": str(stage_instance_id),
                        "attachment_id": str(attachment.id),
                        "bucket": bucket,
                        "object_key": object_key,
                        "size_bytes": size_bytes,
                        "mime_type": upload.content_type,
                    },
                    request_id=request_id,
                )
            )
            self.db.commit()
            self.db.refresh(attachment)
            return attachment
        except Exception:
            self.db.rollback()
            if stored:
                self._cleanup_object(bucket=bucket, object_key=object_key)
            raise

    def list_workflow_attachments(self, *, stage_instance_id: UUID) -> list[WorkflowStageAttachment]:
        self._get_stage_instance(stage_instance_id)
        statement = (
            select(WorkflowStageAttachment)
            .join(File, File.id == WorkflowStageAttachment.file_id)
            .where(
                WorkflowStageAttachment.stage_instance_id == stage_instance_id,
                File.deleted_at.is_(None),
                File.purged_at.is_(None),
            )
            .order_by(WorkflowStageAttachment.created_at)
        )
        return list(self.db.scalars(statement).all())

    def get_active_attachment(self, attachment_id: UUID) -> WorkflowStageAttachment:
        statement = (
            select(WorkflowStageAttachment)
            .join(File, File.id == WorkflowStageAttachment.file_id)
            .where(
                WorkflowStageAttachment.id == attachment_id,
                File.deleted_at.is_(None),
                File.purged_at.is_(None),
            )
        )
        attachment = self.db.scalar(statement)
        if attachment is None:
            raise file_error(
                status_code=status.HTTP_404_NOT_FOUND,
                code="FILE_ATTACHMENT_NOT_FOUND",
                message="Workflow attachment not found",
            )
        return attachment

    def get_attachment(self, attachment_id: UUID) -> WorkflowStageAttachment:
        attachment = self.db.get(WorkflowStageAttachment, attachment_id)
        if attachment is None:
            raise file_error(
                status_code=status.HTTP_404_NOT_FOUND,
                code="FILE_ATTACHMENT_NOT_FOUND",
                message="Workflow attachment not found",
            )
        return attachment

    def soft_delete_attachment(
        self,
        *,
        attachment_id: UUID,
        deleted_by: UUID,
        request_id: str | None = None,
    ) -> WorkflowStageAttachment:
        attachment = self.get_active_attachment(attachment_id)
        file_record = self.get_file(attachment.file_id)
        now = datetime.now(timezone.utc)
        file_record.deleted_at = now
        file_record.delete_after = now + timedelta(days=settings.file_retention_days)
        file_record.deleted_by = deleted_by
        self.audit_repository.add(
            AuditEvent(
                actor_user_id=deleted_by,
                action="file.delete",
                entity_type="file",
                entity_id=file_record.id,
                event_metadata={
                    "attachment_id": str(attachment.id),
                    "stage_instance_id": str(attachment.stage_instance_id),
                    "delete_after": file_record.delete_after.isoformat(),
                },
                request_id=request_id,
            )
        )
        self.db.commit()
        self.db.refresh(attachment)
        return attachment

    def restore_attachment(
        self,
        *,
        attachment_id: UUID,
        restored_by: UUID,
        request_id: str | None = None,
    ) -> WorkflowStageAttachment:
        attachment = self.get_attachment(attachment_id)
        file_record = self.get_file(attachment.file_id)
        if file_record.purged_at is not None:
            raise file_error(
                status_code=409,
                code="FILE_ALREADY_PURGED",
                message="Purged file cannot be restored",
            )
        if file_record.deleted_at is None:
            return attachment

        file_record.deleted_at = None
        file_record.delete_after = None
        file_record.deleted_by = None
        self.audit_repository.add(
            AuditEvent(
                actor_user_id=restored_by,
                action="file.restore",
                entity_type="file",
                entity_id=file_record.id,
                event_metadata={
                    "attachment_id": str(attachment.id),
                    "stage_instance_id": str(attachment.stage_instance_id),
                },
                request_id=request_id,
            )
        )
        self.db.commit()
        self.db.refresh(attachment)
        return attachment

    def purge_expired_files(self, *, limit: int = 100, request_id: str | None = None) -> int:
        now = datetime.now(timezone.utc)
        statement = (
            select(File)
            .where(
                File.deleted_at.is_not(None),
                File.delete_after <= now,
                File.purged_at.is_(None),
                File.bucket.is_not(None),
                File.object_key.is_not(None),
            )
            .order_by(File.delete_after)
            .limit(limit)
        )
        purged_count = 0
        for file_record in self.db.scalars(statement).all():
            try:
                self.storage.delete(bucket=file_record.bucket, object_key=file_record.object_key)
            except Exception:
                self.db.rollback()
                continue

            file_record.purged_at = datetime.now(timezone.utc)
            self.audit_repository.add(
                AuditEvent(
                    actor_user_id=None,
                    action="file.purge",
                    entity_type="file",
                    entity_id=file_record.id,
                    event_metadata={"bucket": file_record.bucket, "object_key": file_record.object_key},
                    request_id=request_id,
                )
            )
            self.db.commit()
            purged_count += 1
        return purged_count

    def get_file(self, file_id: UUID) -> File:
        file_record = self.db.get(File, file_id)
        if file_record is None:
            raise file_error(status_code=404, code="FILE_NOT_FOUND", message="File not found")
        return file_record

    def stream_file(self, *, file_record: File, actor_user_id: UUID, request_id: str | None = None) -> Iterator[bytes]:
        if file_record.deleted_at is not None or file_record.purged_at is not None:
            raise file_error(status_code=404, code="FILE_NOT_FOUND", message="File not found")
        if not file_record.bucket or not file_record.object_key:
            raise file_error(
                status_code=409,
                code="FILE_STORAGE_METADATA_MISSING",
                message="File storage metadata missing",
            )

        stream = self.storage.get_stream(bucket=file_record.bucket, object_key=file_record.object_key)
        self.audit_repository.add(
            AuditEvent(
                actor_user_id=actor_user_id,
                action="file.download",
                entity_type="file",
                entity_id=file_record.id,
                event_metadata={"bucket": file_record.bucket, "object_key": file_record.object_key},
                request_id=request_id,
            )
        )
        self.db.commit()

        def chunks() -> Iterator[bytes]:
            try:
                while chunk := stream.read(CHUNK_SIZE):
                    yield chunk
            finally:
                close = getattr(stream, "close", None)
                if close is not None:
                    close()

        return chunks()

    def _validate_upload(self, *, original_name: str, extension: str, content_type: str | None) -> None:
        if not original_name:
            raise file_error(status_code=400, code="FILE_NAME_REQUIRED", message="Filename is required")
        allowed_mimes = ALLOWED_ATTACHMENT_TYPES.get(extension)
        if allowed_mimes is None:
            raise file_error(
                status_code=400,
                code="FILE_EXTENSION_NOT_ALLOWED",
                message="Unsupported file extension",
                details={"allowed_extensions": sorted(ALLOWED_ATTACHMENT_TYPES)},
            )
        if content_type not in allowed_mimes:
            raise file_error(
                status_code=400,
                code="FILE_MIME_NOT_ALLOWED",
                message="Unsupported file MIME type",
                details={"content_type": content_type, "allowed_mime_types": sorted(allowed_mimes)},
            )

    def _inspect_upload(self, upload: UploadFile, *, extension: str) -> tuple[int, str]:
        digest = sha256()
        size = 0
        head = b""
        upload.file.seek(0)
        while chunk := upload.file.read(CHUNK_SIZE):
            if len(head) < 16:
                head += chunk[: 16 - len(head)]
            size += len(chunk)
            if size > settings.file_max_upload_bytes:
                raise file_error(
                    status_code=413,
                    code="FILE_TOO_LARGE",
                    message="Uploaded file is too large",
                    details={"max_upload_bytes": settings.file_max_upload_bytes},
                )
            digest.update(chunk)
        if size == 0:
            raise file_error(status_code=400, code="FILE_EMPTY", message="Uploaded file is empty")
        signatures = ATTACHMENT_SIGNATURES.get(extension, ())
        if signatures and not any(head.startswith(signature) for signature in signatures):
            raise file_error(
                status_code=400,
                code="FILE_INVALID_FORMAT",
                message="Uploaded file signature does not match extension",
            )
        upload.file.seek(0)
        return size, digest.hexdigest()

    def _get_stage_instance(self, stage_instance_id: UUID) -> WorkflowStageInstance:
        instance = self.db.get(WorkflowStageInstance, stage_instance_id)
        if instance is None:
            raise file_error(
                status_code=404,
                code="WORKFLOW_STAGE_INSTANCE_NOT_FOUND",
                message="Workflow stage instance not found",
            )
        return instance

    def _cleanup_object(self, *, bucket: str, object_key: str) -> None:
        try:
            self.storage.delete(bucket=bucket, object_key=object_key)
        except Exception:
            return

import json
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.core.config import settings
from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.documents.model import File
from app.modules.imports.mapping.service import MappingService, import_error
from app.modules.imports.model import ImportArtifact, ImportJob
from app.modules.imports.parser.factory import reader_for_path
from app.storage import StorageAdapter, get_storage_adapter
from app.security.antivirus import ClamAvScanner, ScanResult

CHUNK_SIZE = 1024 * 1024
IMPORT_MIME_TYPES = {
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    ".xls": {"application/vnd.ms-excel", "application/octet-stream"},
}


class ImportService:
    def __init__(self, db: Session, storage: StorageAdapter | None = None) -> None:
        self.db = db
        self.storage = storage or get_storage_adapter()
        self.audit = AuditEventRepository(db)

    def list_jobs(self, *, limit: int, offset: int) -> ListResult[ImportJob]:
        statement = select(ImportJob).order_by(ImportJob.created_at.desc()).limit(limit).offset(offset)
        total = self.db.scalar(select(func.count()).select_from(ImportJob)) or 0
        return ListResult(items=list(self.db.scalars(statement).all()), total=total)

    def get_job(self, job_id: UUID) -> ImportJob:
        job = self.db.get(ImportJob, job_id)
        if job is None:
            raise import_error("IMPORT_JOB_NOT_FOUND", "Import job not found", 404)
        return job

    def create_job_from_upload(self, *, upload: UploadFile, actor_user_id: UUID, request_id: str | None = None) -> ImportJob:
        original_name = Path(upload.filename or "").name
        extension = Path(original_name).suffix.lower()
        self._validate_upload(original_name=original_name, extension=extension, content_type=upload.content_type)
        size_bytes, checksum, temp_path = self._inspect_to_temp(upload, extension)
        with temp_path.open("rb") as stream:
            scan_status = ClamAvScanner().scan(stream)
        if scan_status is ScanResult.INFECTED:
            temp_path.unlink(missing_ok=True)
            raise import_error("IMPORT_FILE_INFECTED", "Import file was rejected by antivirus scan", 422)
        if scan_status is ScanResult.SCAN_ERROR:
            temp_path.unlink(missing_ok=True)
            raise import_error("ANTIVIRUS_UNAVAILABLE", "Antivirus scan is unavailable", 503)
        job = ImportJob(created_by=actor_user_id, status="UPLOADED", header_row=1)
        bucket = settings.s3_bucket_imports
        object_key = ""
        stored = False
        try:
            reader = reader_for_path(temp_path, original_name)
            metadata = reader.read_metadata()
            self.db.add(job)
            self.db.flush()
            object_name = f"{uuid4()}{extension}"
            object_key = f"imports/{job.id}/{object_name}"
            with temp_path.open("rb") as stream:
                self.storage.put(
                    bucket=bucket,
                    object_key=object_key,
                    data=stream,
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
                uploaded_by=actor_user_id,
                scan_status=scan_status.value,
                delete_after=datetime.now(timezone.utc) + timedelta(days=settings.import_file_retention_days),
            )
            self.db.add(file_record)
            self.db.flush()
            job.source_file_id = file_record.id
            job.sheet_name = metadata.sheet_names[0] if metadata.sheet_names else None
            artifact = ImportArtifact(import_job_id=job.id, file_id=file_record.id, artifact_type="SOURCE")
            self.db.add(artifact)
            self.audit.add(
                AuditEvent(
                    actor_user_id=actor_user_id,
                    action="import.upload",
                    entity_type="import_job",
                    entity_id=job.id,
                    event_metadata={"file_id": str(file_record.id), "checksum": checksum, "bucket": bucket, "scan_status": scan_status.value},
                    request_id=request_id,
                )
            )
            MappingService(self.db).ensure_system_presets()
            self.db.commit()
            self.db.refresh(job)
            return job
        except HTTPException:
            self.db.rollback()
            if stored:
                self._cleanup_object(bucket=bucket, object_key=object_key)
            raise
        except Exception as exc:
            self.db.rollback()
            if stored:
                self._cleanup_object(bucket=bucket, object_key=object_key)
            raise import_error("IMPORT_UPLOAD_FAILED", "Import upload failed", 500) from exc
        finally:
            temp_path.unlink(missing_ok=True)

    def preview(self, *, job_id: UUID, limit: int | None = None):
        job = self.get_job(job_id)
        file_record = self._get_source_file(job)
        temp_path = self._download_to_temp(file_record)
        try:
            reader = reader_for_path(temp_path, file_record.original_name)
            return reader.preview(
                sheet_name=job.sheet_name,
                header_row=job.header_row,
                limit=limit or settings.import_preview_rows,
            )
        finally:
            temp_path.unlink(missing_ok=True)

    def read_rows(self, job: ImportJob) -> list[tuple[int, dict[str, object | None]]]:
        file_record = self._get_source_file(job)
        temp_path = self._download_to_temp(file_record)
        try:
            reader = reader_for_path(temp_path, file_record.original_name)
            return reader.iter_rows(sheet_name=job.sheet_name, header_row=job.header_row)
        finally:
            temp_path.unlink(missing_ok=True)

    def _get_source_file(self, job: ImportJob) -> File:
        if job.source_file_id is None:
            raise import_error("IMPORT_SOURCE_FILE_MISSING", "Import source file is missing", 409)
        file_record = self.db.get(File, job.source_file_id)
        if file_record is None or file_record.deleted_at is not None or file_record.purged_at is not None:
            raise import_error("IMPORT_SOURCE_FILE_MISSING", "Import source file is missing", 409)
        return file_record

    def _validate_upload(self, *, original_name: str, extension: str, content_type: str | None) -> None:
        if not original_name:
            raise import_error("FILE_NAME_REQUIRED", "Filename is required")
        allowed = IMPORT_MIME_TYPES.get(extension)
        if allowed is None:
            raise import_error("IMPORT_UNSUPPORTED_FILE", "Only .xls and .xlsx spreadsheets are supported")
        if content_type and content_type not in allowed:
            raise import_error(
                "IMPORT_UNSUPPORTED_FILE",
                "Unsupported spreadsheet MIME type",
                details={"content_type": content_type, "allowed": sorted(allowed)},
            )

    def _inspect_to_temp(self, upload: UploadFile, extension: str) -> tuple[int, str, Path]:
        digest = sha256()
        size = 0
        with NamedTemporaryFile(delete=False, suffix=extension) as temp:
            upload.file.seek(0)
            while chunk := upload.file.read(CHUNK_SIZE):
                size += len(chunk)
                if size > settings.import_max_upload_bytes:
                    raise import_error(
                        "IMPORT_FILE_TOO_LARGE",
                        "Uploaded file is too large",
                        413,
                        details={"max_upload_bytes": settings.import_max_upload_bytes},
                    )
                digest.update(chunk)
                temp.write(chunk)
        upload.file.seek(0)
        if size == 0:
            Path(temp.name).unlink(missing_ok=True)
            raise import_error("FILE_EMPTY", "Uploaded file is empty")
        return size, digest.hexdigest(), Path(temp.name)

    def create_json_artifact(
        self,
        *,
        job: ImportJob,
        artifact_type: str,
        payload: dict,
        actor_user_id: UUID | None,
    ) -> ImportArtifact:
        data = json.dumps(payload, ensure_ascii=False, default=str, indent=2).encode("utf-8")
        object_name = f"{artifact_type.lower()}-{uuid4()}.json"
        object_key = f"imports/{job.id}/{object_name}"
        bucket = settings.s3_bucket_imports
        self.storage.put(
            bucket=bucket,
            object_key=object_key,
            data=BytesIO(data),
            length=len(data),
            content_type="application/json",
        )
        file_record = File(
            original_name=object_name,
            storage_name=object_name,
            storage_path=f"{bucket}/{object_key}",
            mime_type="application/json",
            extension="json",
            size_bytes=len(data),
            checksum=sha256(data).hexdigest(),
            provider="S3",
            bucket=bucket,
            object_key=object_key,
            uploaded_by=actor_user_id,
            scan_status="NOT_SCANNED",
            delete_after=datetime.now(timezone.utc) + timedelta(days=settings.import_file_retention_days),
        )
        self.db.add(file_record)
        self.db.flush()
        artifact = ImportArtifact(import_job_id=job.id, file_id=file_record.id, artifact_type=artifact_type)
        self.db.add(artifact)
        self.db.flush()
        return artifact

    def _download_to_temp(self, file_record: File) -> Path:
        stream = self.storage.get_stream(bucket=file_record.bucket, object_key=file_record.object_key)
        suffix = f".{file_record.extension}" if file_record.extension else ""
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            try:
                while chunk := stream.read(CHUNK_SIZE):
                    temp.write(chunk)
            finally:
                close = getattr(stream, "close", None)
                if close is not None:
                    close()
            return Path(temp.name)

    def _cleanup_object(self, *, bucket: str, object_key: str) -> None:
        try:
            self.storage.delete(bucket=bucket, object_key=object_key)
        except Exception:
            return

from datetime import datetime, timedelta, timezone
from io import BytesIO
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.audit.model import AuditEvent
from app.modules.documents.file_service import FileService
from app.modules.documents.model import File
from app.modules.workflows.model import WorkflowStageAttachment, WorkflowStageInstance
from app.storage import ObjectStat


class FakeUpload:
    def __init__(self, *, filename: str, content_type: str, data: bytes) -> None:
        self.filename = filename
        self.content_type = content_type
        self.file = BytesIO(data)


class FakeStorage:
    def __init__(self, *, fail_put: bool = False, fail_delete: bool = False) -> None:
        self.fail_put = fail_put
        self.fail_delete = fail_delete
        self.objects: dict[tuple[str, str], bytes] = {}
        self.deleted: list[tuple[str, str]] = []

    def put(self, *, bucket, object_key, data, length, content_type=None):
        if self.fail_put:
            raise RuntimeError("storage put failed")
        self.objects[(bucket, object_key)] = data.read()
        return ObjectStat(bucket=bucket, object_key=object_key, size=length, content_type=content_type)

    def get_stream(self, *, bucket, object_key):
        return BytesIO(self.objects[(bucket, object_key)])

    def delete(self, *, bucket, object_key):
        if self.fail_delete:
            raise RuntimeError("storage delete failed")
        self.deleted.append((bucket, object_key))
        self.objects.pop((bucket, object_key), None)

    def stat(self, *, bucket, object_key):
        return ObjectStat(bucket=bucket, object_key=object_key, size=len(self.objects[(bucket, object_key)]))

    def presign_get(self, *, bucket, object_key, expires_seconds):
        return f"http://storage/{bucket}/{object_key}?expires={expires_seconds}"


class FakeScalars:
    def __init__(self, values: list) -> None:
        self.values = values

    def all(self):
        return self.values


class FakeDb:
    def __init__(self, *, stage_instance: WorkflowStageInstance | None = None, fail_flush_after: int | None = None):
        self.entities = {}
        self.added = []
        self.commits = 0
        self.rollbacks = 0
        self.flushes = 0
        self.fail_flush_after = fail_flush_after
        self.scalar_result = None
        self.scalars_result = []
        if stage_instance is not None:
            self.entities[(WorkflowStageInstance, stage_instance.id)] = stage_instance

    def get(self, model, entity_id):
        return self.entities.get((model, entity_id))

    def add(self, entity):
        self.added.append(entity)
        if getattr(entity, "id", None) is None:
            entity.id = uuid4()
        self.entities[(type(entity), entity.id)] = entity

    def flush(self):
        self.flushes += 1
        if self.fail_flush_after is not None and self.flushes >= self.fail_flush_after:
            raise RuntimeError("db flush failed")

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def refresh(self, entity):
        return None

    def scalar(self, statement):
        return self.scalar_result

    def scalars(self, statement):
        return FakeScalars(self.scalars_result)


def make_stage_instance() -> WorkflowStageInstance:
    return WorkflowStageInstance(
        id=uuid4(),
        interaction_id=uuid4(),
        workflow_stage_id=uuid4(),
        status="IN_PROGRESS",
    )


def test_upload_workflow_attachment_stores_object_metadata_attachment_and_audit() -> None:
    stage_instance = make_stage_instance()
    db = FakeDb(stage_instance=stage_instance)
    storage = FakeStorage()

    attachment = FileService(db, storage).upload_workflow_attachment(
        stage_instance_id=stage_instance.id,
        upload=FakeUpload(filename="contract.pdf", content_type="application/pdf", data=b"%PDF content"),
        uploaded_by=uuid4(),
        description="signed",
        attachment_kind="contract",
        request_id="req-1",
    )

    file_record = next(entity for entity in db.added if isinstance(entity, File))
    audit = next(entity for entity in db.added if isinstance(entity, AuditEvent))
    assert attachment.file_id == file_record.id
    assert attachment.description == "signed"
    assert file_record.original_name == "contract.pdf"
    assert file_record.provider == "S3"
    assert file_record.attachment_kind == "contract"
    assert file_record.bucket == "workflow-files"
    assert file_record.object_key.startswith(f"interactions/{stage_instance.interaction_id}/stages/{stage_instance.id}/")
    assert file_record.checksum
    assert storage.objects[(file_record.bucket, file_record.object_key)] == b"%PDF content"
    assert audit.action == "file.upload"
    assert db.commits == 1
    assert db.rollbacks == 0


def test_upload_rejects_unsupported_extension_before_storage_write() -> None:
    stage_instance = make_stage_instance()
    db = FakeDb(stage_instance=stage_instance)
    storage = FakeStorage()

    with pytest.raises(HTTPException) as error:
        FileService(db, storage).upload_workflow_attachment(
            stage_instance_id=stage_instance.id,
            upload=FakeUpload(filename="notes.txt", content_type="text/plain", data=b"text"),
            uploaded_by=uuid4(),
        )

    assert error.value.status_code == 400
    assert error.value.detail["code"] == "FILE_EXTENSION_NOT_ALLOWED"
    assert storage.objects == {}


def test_upload_accepts_required_png_attachment_type() -> None:
    stage_instance = make_stage_instance()
    db = FakeDb(stage_instance=stage_instance)
    storage = FakeStorage()

    attachment = FileService(db, storage).upload_workflow_attachment(
        stage_instance_id=stage_instance.id,
        upload=FakeUpload(filename="proof.png", content_type="image/png", data=b"\x89PNG\r\n\x1a\ncontent"),
        uploaded_by=uuid4(),
    )

    file_record = next(entity for entity in db.added if isinstance(entity, File))
    assert attachment.file_id == file_record.id
    assert file_record.extension == "png"


def test_upload_rejects_signature_mismatch() -> None:
    stage_instance = make_stage_instance()
    db = FakeDb(stage_instance=stage_instance)
    storage = FakeStorage()

    with pytest.raises(HTTPException) as error:
        FileService(db, storage).upload_workflow_attachment(
            stage_instance_id=stage_instance.id,
            upload=FakeUpload(filename="proof.png", content_type="image/png", data=b"not png"),
            uploaded_by=uuid4(),
        )

    assert error.value.detail["code"] == "FILE_INVALID_FORMAT"
    assert storage.objects == {}


def test_upload_cleans_storage_object_when_db_save_fails() -> None:
    stage_instance = make_stage_instance()
    db = FakeDb(stage_instance=stage_instance, fail_flush_after=2)
    storage = FakeStorage()

    with pytest.raises(RuntimeError, match="db flush failed"):
        FileService(db, storage).upload_workflow_attachment(
            stage_instance_id=stage_instance.id,
            upload=FakeUpload(filename="contract.pdf", content_type="application/pdf", data=b"%PDF content"),
            uploaded_by=uuid4(),
        )

    assert db.rollbacks == 1
    assert storage.objects == {}
    assert len(storage.deleted) == 1


def test_soft_delete_and_restore_update_file_lifecycle_and_audit() -> None:
    actor_id = uuid4()
    file_record = File(
        id=uuid4(),
        original_name="contract.pdf",
        storage_name="stored.pdf",
        storage_path="workflow-files/stored.pdf",
        bucket="workflow-files",
        object_key="stored.pdf",
        scan_status="NOT_SCANNED",
    )
    attachment = WorkflowStageAttachment(
        id=uuid4(),
        stage_instance_id=uuid4(),
        file_id=file_record.id,
        uploaded_by=actor_id,
    )
    db = FakeDb()
    db.scalar_result = attachment
    db.entities[(File, file_record.id)] = file_record
    db.entities[(WorkflowStageAttachment, attachment.id)] = attachment
    service = FileService(db, FakeStorage())

    service.soft_delete_attachment(attachment_id=attachment.id, deleted_by=actor_id, request_id="delete-req")

    assert file_record.deleted_at is not None
    assert file_record.delete_after is not None
    assert file_record.delete_after > file_record.deleted_at
    assert file_record.deleted_by == actor_id
    assert any(isinstance(entity, AuditEvent) and entity.action == "file.delete" for entity in db.added)

    service.restore_attachment(attachment_id=attachment.id, restored_by=actor_id, request_id="restore-req")

    assert file_record.deleted_at is None
    assert file_record.delete_after is None
    assert file_record.deleted_by is None
    assert any(isinstance(entity, AuditEvent) and entity.action == "file.restore" for entity in db.added)


def test_purge_expired_files_deletes_storage_then_marks_purged_and_audits() -> None:
    file_record = File(
        id=uuid4(),
        original_name="contract.pdf",
        storage_name="stored.pdf",
        storage_path="workflow-files/stored.pdf",
        bucket="workflow-files",
        object_key="stored.pdf",
        scan_status="NOT_SCANNED",
        deleted_at=datetime.now(timezone.utc) - timedelta(days=31),
        delete_after=datetime.now(timezone.utc) - timedelta(days=1),
    )
    db = FakeDb()
    db.scalars_result = [file_record]
    storage = FakeStorage()
    storage.objects[(file_record.bucket, file_record.object_key)] = b"content"

    count = FileService(db, storage).purge_expired_files(limit=10, request_id="purge-req")

    assert count == 1
    assert file_record.purged_at is not None
    assert storage.deleted == [(file_record.bucket, file_record.object_key)]
    assert any(isinstance(entity, AuditEvent) and entity.action == "file.purge" for entity in db.added)

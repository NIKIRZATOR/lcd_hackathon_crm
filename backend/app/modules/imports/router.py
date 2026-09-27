from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.auth.access import ADMIN_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.imports.apply.service import ImportApplyService
from app.modules.imports.diff.service import ImportDiffService
from app.modules.imports.mapping.registry import TARGET_FIELDS
from app.modules.imports.mapping.service import MappingService, import_error
from app.modules.documents.file_service import FileService
from app.modules.documents.model import File as StoredFile
from app.modules.imports.model import ImportArtifact, ImportRowError
from app.modules.imports.schemas import (
    ImportConfirmRead,
    ImportDiffRead,
    ImportJobRead,
    ImportJobConfigUpdate,
    ImportMappingCreate,
    ImportMappingFieldRead,
    ImportMappingRead,
    ImportPreviewRead,
    ImportRowErrorRead,
    ImportValidateRead,
    JobMappingRead,
    JobMappingUpdate,
    MappingFieldPayload,
    TargetFieldRead,
)
from app.modules.imports.service import ImportService
from app.modules.imports.validation.validator import ImportValidator
from app.modules.users.model import User

router = APIRouter(
    prefix="/imports",
    tags=["imports"],
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)


@router.get(
    "/fields",
    response_model=list[TargetFieldRead],
    summary="List import target fields",
    description="Returns the internal CRM fields supported by the Stage 4 import pipeline.",
)
def list_target_fields():
    return [TargetFieldRead(**field.__dict__) for field in TARGET_FIELDS]


@router.get(
    "/mappings",
    response_model=list[ImportMappingRead],
    summary="List import mappings",
    description="Lists reusable mappings, including the built-in RTK_DEFAULT_V1 preset.",
)
def list_mappings(db: Session = Depends(get_db_session)):
    service = MappingService(db)
    return [_mapping_read(service, mapping.id) for mapping in service.list_mappings()]


@router.post(
    "/mappings",
    response_model=ImportMappingRead,
    status_code=201,
    summary="Create import mapping",
    description="Creates a reusable spreadsheet-column to CRM-field mapping.",
)
def create_mapping(
    payload: ImportMappingCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    mapping = MappingService(db).create_mapping(name=payload.name, fields=payload.fields, created_by=current_user.id)
    return _mapping_read(MappingService(db), mapping.id)


@router.post(
    "",
    response_model=ImportJobRead,
    status_code=201,
    summary="Upload XLS/XLSX source and create ImportJob",
    description="Stores the source spreadsheet in the imports bucket and creates ImportJob metadata without mutating CRM data.",
)
def create_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return _job_read(ImportService(db).create_job_from_upload(upload=file, actor_user_id=current_user.id), db)


@router.get("", response_model=Page[ImportJobRead], summary="List import jobs")
def list_imports(pagination: PaginationParams = Depends(), db: Session = Depends(get_db_session)):
    result = ImportService(db).list_jobs(limit=pagination.limit, offset=pagination.offset)
    return Page(items=[_job_read(job, db) for job in result.items], total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/{job_id}", response_model=ImportJobRead, summary="Get import job")
def get_import(job_id: UUID, db: Session = Depends(get_db_session)):
    return _job_read(ImportService(db).get_job(job_id), db)


@router.get(
    "/{job_id}/preview",
    response_model=ImportPreviewRead,
    summary="Preview spreadsheet",
    description="Returns sheet names, headers and a limited row sample. Does not mutate CRM data.",
)
def preview_import(job_id: UUID, limit: int = 20, db: Session = Depends(get_db_session)):
    preview = ImportService(db).preview(job_id=job_id, limit=limit)
    return ImportPreviewRead(
        jobId=job_id,
        sheetNames=preview.sheet_names,
        sheet=preview.sheet,
        headers=preview.headers,
        rows=preview.rows,
        totalRows=preview.total_rows,
        fileType=preview.file_type,
    )


@router.patch(
    "/{job_id}/config",
    response_model=ImportJobRead,
    summary="Update import spreadsheet configuration",
    description="Updates selected sheet/header row before validation and invalidates mapping, errors and diff.",
)
def update_import_config(
    job_id: UUID,
    payload: ImportJobConfigUpdate,
    db: Session = Depends(get_db_session),
):
    job = ImportService(db).get_job(job_id)
    if job.status in {"RUNNING", "DONE"}:
        raise import_error("IMPORT_CONFIG_LOCKED", "Cannot change config for running or completed import", 409)
    job.sheet_name = payload.sheet_name
    job.header_row = payload.header_row
    job.mapping_id = None
    job.mapping_snapshot = None
    job.diff_snapshot = None
    job.total_rows = job.valid_rows = job.invalid_rows = 0
    job.create_count = job.update_count = job.skip_count = job.conflict_count = 0
    job.validated_at = None
    job.status = "UPLOADED"
    db.execute(delete(ImportRowError).where(ImportRowError.import_job_id == job.id))
    ImportService(db).preview(job_id=job.id, limit=1)
    db.commit()
    db.refresh(job)
    return _job_read(job, db)


@router.get("/{job_id}/mapping", response_model=JobMappingRead, summary="Get import job mapping snapshot")
def get_job_mapping(job_id: UUID, db: Session = Depends(get_db_session)):
    job = ImportService(db).get_job(job_id)
    snapshot = job.mapping_snapshot or {}
    return JobMappingRead(
        job_id=job.id,
        mapping_id=job.mapping_id,
        fields=[MappingFieldPayload(**field) for field in snapshot.get("fields", [])],
    )


@router.put(
    "/{job_id}/mapping",
    response_model=JobMappingRead,
    summary="Set import job mapping",
    description="Copies a reusable mapping or custom fields into an immutable job snapshot.",
)
def set_job_mapping(
    job_id: UUID,
    payload: JobMappingUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    job = ImportService(db).get_job(job_id)
    mapping_service = MappingService(db)
    if payload.mapping_id:
        job.mapping_id = payload.mapping_id
        job.mapping_snapshot = mapping_service.snapshot_from_mapping(payload.mapping_id)
    elif payload.fields is not None:
        job.mapping_id = None
        job.mapping_snapshot = mapping_service.snapshot_from_payload(payload.fields)
    else:
        raise import_error("IMPORT_MAPPING_INVALID", "mapping_id or fields must be provided")
    job.status = "MAPPED"
    job.diff_snapshot = None
    AuditEventRepository(db).add(
        AuditEvent(
            actor_user_id=current_user.id,
            action="import.mapping.update",
            entity_type="import_job",
            entity_id=job.id,
            event_metadata={"mapping_id": str(job.mapping_id) if job.mapping_id else None},
        )
    )
    db.commit()
    db.refresh(job)
    return get_job_mapping(job_id, db)


@router.post("/{job_id}/validate", response_model=ImportValidateRead, summary="Validate import rows")
def validate_import(
    job_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    job = ImportValidator(db).validate(job_id=job_id, actor_user_id=current_user.id)
    return ImportValidateRead(
        job_id=job.id,
        status=job.status,
        total_rows=job.total_rows,
        valid_rows=job.valid_rows,
        invalid_rows=job.invalid_rows,
    )


@router.get("/{job_id}/errors", response_model=Page[ImportRowErrorRead], summary="List import row errors")
def list_errors(job_id: UUID, pagination: PaginationParams = Depends(), db: Session = Depends(get_db_session)):
    ImportService(db).get_job(job_id)
    statement = (
        select(ImportRowError)
        .where(ImportRowError.import_job_id == job_id)
        .order_by(ImportRowError.row_number, ImportRowError.created_at)
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    total = len(list(db.scalars(select(ImportRowError).where(ImportRowError.import_job_id == job_id)).all()))
    return Page(items=list(db.scalars(statement).all()), total=total, limit=pagination.limit, offset=pagination.offset)


@router.get("/{job_id}/diff", response_model=ImportDiffRead, summary="Build or get import diff")
def get_diff(
    job_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    job = ImportService(db).get_job(job_id)
    if not job.diff_snapshot:
        job = ImportDiffService(db).build_diff(job_id=job_id, actor_user_id=current_user.id)
    return ImportDiffRead(
        job_id=job.id,
        status=job.status,
        create_count=job.create_count,
        update_count=job.update_count,
        skip_count=job.skip_count,
        conflict_count=job.conflict_count,
        items=job.diff_snapshot.get("items", []),
    )


@router.post("/{job_id}/confirm", response_model=ImportConfirmRead, summary="Confirm and apply import transactionally")
def confirm_import(
    job_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    job = ImportApplyService(db).confirm(job_id=job_id, actor_user_id=current_user.id)
    return ImportConfirmRead(
        job_id=job.id,
        status=job.status,
        create_count=job.create_count,
        update_count=job.update_count,
        skip_count=job.skip_count,
        conflict_count=job.conflict_count,
    )


@router.get("/{job_id}/artifacts/{artifact_type}/download")
def download_import_artifact(
    job_id: UUID,
    artifact_type: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    if artifact_type not in {"PROTOCOL", "ERROR_REPORT"}:
        raise HTTPException(status_code=404, detail="Import artifact not found")
    artifact = db.scalar(
        select(ImportArtifact)
        .where(ImportArtifact.import_job_id == job_id, ImportArtifact.artifact_type == artifact_type)
        .order_by(ImportArtifact.created_at.desc())
        .limit(1)
    )
    if artifact is None:
        raise HTTPException(status_code=404, detail="Import artifact not found")
    file_record = db.get(StoredFile, artifact.file_id)
    if file_record is None:
        raise HTTPException(status_code=404, detail="Import artifact file not found")
    return StreamingResponse(
        FileService(db).stream_file(file_record=file_record, actor_user_id=current_user.id),
        media_type=file_record.mime_type or "application/json",
        headers={"Content-Disposition": f'attachment; filename="{file_record.original_name}"'},
    )


def _mapping_read(service: MappingService, mapping_id: UUID) -> ImportMappingRead:
    mapping = service.get_mapping(mapping_id)
    fields = [ImportMappingFieldRead.model_validate(field) for field in service.get_mapping_fields(mapping.id)]
    return ImportMappingRead(
        id=mapping.id,
        name=mapping.name,
        is_system=mapping.is_system,
        created_by=mapping.created_by,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at,
        fields=fields,
    )


def _job_read(job, db: Session) -> ImportJobRead:
    source_file = db.get(StoredFile, job.source_file_id) if job.source_file_id else None
    author = db.get(User, job.created_by)
    return ImportJobRead.model_validate(job).model_copy(
        update={
            "source_file_name": source_file.original_name if source_file else None,
            "created_by_name": author.full_name if author else None,
        }
    )

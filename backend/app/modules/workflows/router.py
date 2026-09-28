from uuid import UUID

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.errors import ErrorEnvelope, get_request_id
from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import ADMIN_ROLES, CRM_ROLES, TEMPLATE_EDITOR_ROLES, ensure_can_read_interaction, forbidden, is_admin
from app.modules.auth.dependencies import require_roles
from app.modules.documents.file_service import FileService
from app.modules.documents.model import File as FileModel
from app.modules.documents.schemas import WorkflowAttachmentRead
from app.modules.checklists.model import PlaybookChecklistItem
from app.modules.interactions.model import UniversityInteraction
from app.modules.users.model import User
from app.modules.workflows.model import WorkflowStage, WorkflowStageAttachment, WorkflowStageComment, WorkflowStageData, WorkflowStageInstance, WorkflowVersion
from app.modules.workflows.access import ensure_can_access_stage_instance
from app.modules.workflows.schemas import (
    WorkflowAvailableTransitionRead,
    WorkflowChecklistItemCreate,
    WorkflowChecklistItemRead,
    WorkflowChecklistItemUpdate,
    WorkflowChangeRequestCreate,
    WorkflowChangeRequestRead,
    WorkflowChangeRequestReview,
    WorkflowDangerousChangesRead,
    WorkflowMigrationExecuteRequest,
    WorkflowMigrationJobRead,
    WorkflowMigrationPreviewRead,
    WorkflowMigrationPreviewRequest,
    WorkflowStageCreate,
    WorkflowStageCommentCreate,
    WorkflowStageCommentRead,
    WorkflowStageInstanceRead,
    WorkflowStageInstanceStatusUpdate,
    WorkflowStageRead,
    WorkflowStageUpdate,
    WorkflowTemplateCreate,
    WorkflowTemplateRead,
    WorkflowTemplateUpdate,
    WorkflowTransitionCreate,
    WorkflowTransitionExecute,
    WorkflowTransitionHistoryRead,
    WorkflowTransitionRead,
    WorkflowTransitionResult,
    WorkflowTransitionUpdate,
    WorkflowVersionRead,
)
from app.modules.workflows.service import (
    WorkflowRuntimeService,
    WorkflowStageService,
    WorkflowTemplateService,
    WorkflowTransitionService,
    WorkflowVersionService,
)
from app.modules.workflows.stage_data_schemas import stage_data_json_schemas, validate_stage_payload
from app.modules.workflow_catalog.model import WorkflowStageCatalog

router = APIRouter(
    prefix="/workflows",
    tags=["workflows"],
    dependencies=[Depends(require_roles(*CRM_ROLES))],
)


class WorkflowStageDataUpdate(BaseModel):
    payload: dict = Field(default_factory=dict)


class WorkflowStageDataRead(WorkflowStageDataUpdate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    stage_instance_id: UUID


@router.get("/stage-data/schemas", response_model=dict[str, dict])
def get_stage_data_schemas():
    return stage_data_json_schemas()


def _ensure_can_access_interaction(db: Session, current_user: User, interaction_id: UUID) -> UniversityInteraction:
    interaction = db.get(UniversityInteraction, interaction_id)
    if interaction is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University interaction not found")
    ensure_can_read_interaction(db, current_user, interaction)
    return interaction


def _ensure_can_access_stage_instance(db: Session, current_user: User, stage_instance_id: UUID) -> WorkflowStageInstance:
    return ensure_can_access_stage_instance(db, current_user, stage_instance_id)


@router.get("/stage-instances/{stage_instance_id}/data", response_model=WorkflowStageDataRead | None)
def get_stage_data(stage_instance_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    _ensure_can_access_stage_instance(db, current_user, stage_instance_id)
    return db.scalar(select(WorkflowStageData).where(WorkflowStageData.stage_instance_id == stage_instance_id))


@router.put("/stage-instances/{stage_instance_id}/data", response_model=WorkflowStageDataRead)
def replace_stage_data(stage_instance_id: UUID, payload: WorkflowStageDataUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    stage_instance = _ensure_can_access_stage_instance(db, current_user, stage_instance_id)
    stage_code = db.scalar(
        select(WorkflowStageCatalog.code)
        .join(WorkflowStage, WorkflowStage.stage_catalog_id == WorkflowStageCatalog.id)
        .where(WorkflowStage.id == stage_instance.workflow_stage_id)
    )
    if stage_code is None:
        raise HTTPException(status_code=422, detail="Workflow stage has no catalog code")
    validated_payload = validate_stage_payload(stage_code, payload.payload)
    data = db.scalar(select(WorkflowStageData).where(WorkflowStageData.stage_instance_id == stage_instance_id))
    if data is None:
        data = WorkflowStageData(stage_instance_id=stage_instance_id, payload=validated_payload)
        db.add(data)
    else:
        data.payload = validated_payload
    db.commit()
    db.refresh(data)
    return data


def _ensure_can_access_attachment(
    db: Session,
    current_user: User,
    attachment: WorkflowStageAttachment,
) -> WorkflowStageInstance:
    return _ensure_can_access_stage_instance(db, current_user, attachment.stage_instance_id)


def _attachment_read(db: Session, attachment: WorkflowStageAttachment) -> WorkflowAttachmentRead:
    file_record = db.get(FileModel, attachment.file_id)
    return WorkflowAttachmentRead(
        id=attachment.id,
        stage_instance_id=attachment.stage_instance_id,
        file_id=attachment.file_id,
        uploaded_by=attachment.uploaded_by,
        description=attachment.description,
        created_at=attachment.created_at,
        original_name=file_record.original_name if file_record is not None else "",
        mime_type=file_record.mime_type if file_record is not None else None,
        extension=file_record.extension if file_record is not None else None,
        size_bytes=file_record.size_bytes if file_record is not None else None,
        checksum=file_record.checksum if file_record is not None else None,
        scan_status=file_record.scan_status if file_record is not None else "UNKNOWN",
        attachment_kind=file_record.attachment_kind if file_record is not None else None,
    )


@router.get("/templates", response_model=Page[WorkflowTemplateRead])
def list_templates(
    search: str | None = None,
    is_active: bool | None = None,
    is_default: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = WorkflowTemplateService(db).list_templates(
        search=search,
        is_active=is_active,
        is_default=is_default,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/templates/{template_id}", response_model=WorkflowTemplateRead)
def get_template(template_id: UUID, db: Session = Depends(get_db_session)):
    return WorkflowTemplateService(db).get_template(template_id)


@router.post("/templates", response_model=WorkflowTemplateRead, status_code=201)
def create_template(
    payload: WorkflowTemplateCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*TEMPLATE_EDITOR_ROLES)),
):
    return WorkflowTemplateService(db).create_template(payload, created_by=current_user.id)


@router.patch("/templates/{template_id}", response_model=WorkflowTemplateRead)
def update_template(
    template_id: UUID,
    payload: WorkflowTemplateUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*TEMPLATE_EDITOR_ROLES)),
):
    return WorkflowTemplateService(db).update_template(template_id, payload)


@router.get("/templates/{template_id}/versions", response_model=list[WorkflowVersionRead])
def list_template_versions(template_id: UUID, db: Session = Depends(get_db_session)):
    return WorkflowVersionService(db).list_versions(template_id)


@router.get("/change-requests", response_model=Page[WorkflowChangeRequestRead])
def list_workflow_change_requests(
    workflow_version_id: UUID | None = None,
    status: str | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    result = WorkflowVersionService(db).list_change_requests(
        workflow_version_id=workflow_version_id,
        status_value=status,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/change-requests/{change_request_id}", response_model=WorkflowChangeRequestRead)
def get_workflow_change_request(
    change_request_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).get_change_request(change_request_id)


@router.post("/templates/{template_id}/versions/draft", response_model=WorkflowVersionRead, status_code=201)
def create_template_draft(
    template_id: UUID,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*TEMPLATE_EDITOR_ROLES)),
):
    return WorkflowVersionService(db).create_draft(
        template_id,
        created_by=current_user.id,
        request_id=get_request_id(request),
    )


@router.post("/versions/{version_id}/change-request", response_model=WorkflowChangeRequestRead, status_code=201)
def create_workflow_change_request(
    version_id: UUID,
    payload: WorkflowChangeRequestCreate,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).create_change_request(
        version_id,
        payload,
        requested_by=current_user.id,
        request_id=get_request_id(request),
    )


@router.post("/change-requests/{change_request_id}/approve", response_model=WorkflowChangeRequestRead)
def approve_workflow_change_request(
    change_request_id: UUID,
    payload: WorkflowChangeRequestReview,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).approve_change_request(
        change_request_id,
        payload,
        reviewed_by=current_user.id,
        request_id=get_request_id(request),
    )


@router.post("/change-requests/{change_request_id}/reject", response_model=WorkflowChangeRequestRead)
def reject_workflow_change_request(
    change_request_id: UUID,
    payload: WorkflowChangeRequestReview,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).reject_change_request(
        change_request_id,
        payload,
        reviewed_by=current_user.id,
        request_id=get_request_id(request),
    )


@router.post("/versions/{version_id}/publish", response_model=WorkflowVersionRead)
def publish_workflow_version(
    version_id: UUID,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*TEMPLATE_EDITOR_ROLES)),
):
    return WorkflowVersionService(db).publish_version(
        version_id,
        actor_user_id=current_user.id,
        request_id=get_request_id(request),
    )


@router.get("/versions/{version_id}/dangerous-changes", response_model=WorkflowDangerousChangesRead)
def get_workflow_version_dangerous_changes(
    version_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).detect_dangerous_changes(version_id)


@router.post("/versions/{version_id}/migration/preview", response_model=WorkflowMigrationPreviewRead)
def preview_workflow_migration(
    version_id: UUID,
    payload: WorkflowMigrationPreviewRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).preview_migration(version_id, payload)


@router.post("/versions/{version_id}/migration/execute", response_model=WorkflowMigrationJobRead)
def execute_workflow_migration(
    version_id: UUID,
    payload: WorkflowMigrationExecuteRequest,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return WorkflowVersionService(db).execute_migration(
        version_id,
        payload,
        created_by=current_user.id,
        request_id=get_request_id(request),
    )


@router.get("/stages", response_model=Page[WorkflowStageRead])
def list_stages(
    workflow_template_id: UUID | None = None,
    workflow_version_id: UUID | None = None,
    is_active: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = WorkflowStageService(db).list_stages(
        workflow_template_id=workflow_template_id,
        workflow_version_id=workflow_version_id,
        is_active=is_active,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/stages/{stage_id}", response_model=WorkflowStageRead)
def get_stage(stage_id: UUID, db: Session = Depends(get_db_session)):
    return WorkflowStageService(db).get_stage(stage_id)


@router.post("/stages", response_model=WorkflowStageRead, status_code=201)
def create_stage(
    payload: WorkflowStageCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*TEMPLATE_EDITOR_ROLES)),
):
    return WorkflowStageService(db).create_stage(payload)


@router.patch("/stages/{stage_id}", response_model=WorkflowStageRead)
def update_stage(
    stage_id: UUID,
    payload: WorkflowStageUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*TEMPLATE_EDITOR_ROLES)),
):
    return WorkflowStageService(db).update_stage(stage_id, payload)


def _draft_stage_or_409(db: Session, stage_id: UUID) -> WorkflowStage:
    stage = db.get(WorkflowStage, stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="Workflow stage not found")
    version = db.get(WorkflowVersion, stage.workflow_version_id)
    if version is None or version.status != "DRAFT":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Checklist definitions can be changed only in a draft")
    return stage


@router.get("/stages/{stage_id}/checklist-items", response_model=list[WorkflowChecklistItemRead])
def list_stage_checklist_items(stage_id: UUID, db: Session = Depends(get_db_session)):
    _draft_stage_or_409(db, stage_id)
    return list(db.scalars(select(PlaybookChecklistItem).where(PlaybookChecklistItem.workflow_stage_id == stage_id).order_by(PlaybookChecklistItem.created_at)).all())


@router.post("/stages/{stage_id}/checklist-items", response_model=WorkflowChecklistItemRead, status_code=201)
def create_stage_checklist_item(stage_id: UUID, payload: WorkflowChecklistItemCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*TEMPLATE_EDITOR_ROLES))):
    _draft_stage_or_409(db, stage_id)
    if db.scalar(select(PlaybookChecklistItem.id).where(PlaybookChecklistItem.workflow_stage_id == stage_id, PlaybookChecklistItem.code == payload.code)):
        raise HTTPException(status_code=409, detail="Checklist item code already exists in this stage")
    item = PlaybookChecklistItem(workflow_stage_id=stage_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/stages/{stage_id}/checklist-items/{item_id}", response_model=WorkflowChecklistItemRead)
def update_stage_checklist_item(stage_id: UUID, item_id: UUID, payload: WorkflowChecklistItemUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*TEMPLATE_EDITOR_ROLES))):
    _draft_stage_or_409(db, stage_id)
    item = db.get(PlaybookChecklistItem, item_id)
    if item is None or item.workflow_stage_id != stage_id:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/stages/{stage_id}/checklist-items/{item_id}", status_code=204)
def delete_stage_checklist_item(stage_id: UUID, item_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*TEMPLATE_EDITOR_ROLES))):
    _draft_stage_or_409(db, stage_id)
    item = db.get(PlaybookChecklistItem, item_id)
    if item is None or item.workflow_stage_id != stage_id:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    db.delete(item)
    db.commit()


@router.get("/transitions", response_model=Page[WorkflowTransitionRead])
def list_transitions(
    workflow_template_id: UUID | None = None,
    workflow_version_id: UUID | None = None,
    from_stage_id: UUID | None = None,
    to_stage_id: UUID | None = None,
    is_default: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = WorkflowTransitionService(db).list_transitions(
        workflow_template_id=workflow_template_id,
        workflow_version_id=workflow_version_id,
        from_stage_id=from_stage_id,
        to_stage_id=to_stage_id,
        is_default=is_default,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/transitions/{transition_id}", response_model=WorkflowTransitionRead)
def get_transition(transition_id: UUID, db: Session = Depends(get_db_session)):
    return WorkflowTransitionService(db).get_transition(transition_id)


@router.post("/transitions", response_model=WorkflowTransitionRead, status_code=201)
def create_transition(
    payload: WorkflowTransitionCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*TEMPLATE_EDITOR_ROLES)),
):
    return WorkflowTransitionService(db).create_transition(payload)


@router.patch("/transitions/{transition_id}", response_model=WorkflowTransitionRead)
def update_transition(
    transition_id: UUID,
    payload: WorkflowTransitionUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*TEMPLATE_EDITOR_ROLES)),
):
    return WorkflowTransitionService(db).update_transition(transition_id, payload)


@router.get("/stage-instances", response_model=Page[WorkflowStageInstanceRead])
def list_stage_instances(
    interaction_id: UUID | None = None,
    status: str | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    if interaction_id is None and not is_admin(current_user):
        raise forbidden("interaction_id is required for this role")
    if interaction_id is not None:
        _ensure_can_access_interaction(db, current_user, interaction_id)
    result = WorkflowRuntimeService(db).list_stage_instances(
        interaction_id=interaction_id,
        status_value=status,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/interactions/{interaction_id}/current-stage", response_model=WorkflowStageInstanceRead)
def get_current_stage_instance(
    interaction_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    _ensure_can_access_interaction(db, current_user, interaction_id)
    return WorkflowRuntimeService(db).get_current_stage_instance(interaction_id)


@router.get("/interactions/{interaction_id}/available-transitions", response_model=list[WorkflowAvailableTransitionRead])
def list_available_transitions(
    interaction_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    _ensure_can_access_interaction(db, current_user, interaction_id)
    return WorkflowRuntimeService(db).list_available_transitions(interaction_id)


@router.patch("/stage-instances/{stage_instance_id}/status", response_model=WorkflowStageInstanceRead)
def update_stage_instance_status(
    stage_instance_id: UUID,
    payload: WorkflowStageInstanceStatusUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    instance = db.get(WorkflowStageInstance, stage_instance_id)
    if instance is not None:
        _ensure_can_access_interaction(db, current_user, instance.interaction_id)
    return WorkflowRuntimeService(db).update_stage_instance_status(stage_instance_id, payload)


@router.get("/stage-instances/{stage_instance_id}/comments", response_model=list[WorkflowStageCommentRead])
def list_stage_comments(
    stage_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    _ensure_can_access_stage_instance(db, current_user, stage_instance_id)
    return list(
        db.scalars(
            select(WorkflowStageComment)
            .where(WorkflowStageComment.stage_instance_id == stage_instance_id, WorkflowStageComment.deleted_at.is_(None))
            .order_by(WorkflowStageComment.created_at)
        ).all()
    )


@router.post("/stage-instances/{stage_instance_id}/comments", response_model=WorkflowStageCommentRead, status_code=201)
def create_stage_comment(
    stage_instance_id: UUID,
    payload: WorkflowStageCommentCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    _ensure_can_access_stage_instance(db, current_user, stage_instance_id)
    comment = WorkflowStageComment(stage_instance_id=stage_instance_id, author_user_id=current_user.id, text=payload.text)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.post(
    "/stage-instances/{stage_instance_id}/attachments",
    response_model=WorkflowAttachmentRead,
    status_code=201,
    summary="Загрузить attachment к workflow stage",
    description=(
        "Загружает реальный PDF, DOCX или XLSX файл для workflow stage instance. "
        "Backend валидирует extension, MIME type, пустой файл и максимальный размер; сохраняет binary content в "
        "S3-compatible object storage; пишет metadata в `files`; создает связь `workflow_stage_attachments`; "
        "и записывает audit event `file.upload`. Доступ проверяется через interaction, связанный со stage instance."
    ),
    response_description="Созданный workflow attachment с file metadata.",
    responses={
        400: {
            "model": ErrorEnvelope,
            "description": "Файл не прошел валидацию: пустой файл, нет имени, unsupported extension или MIME type.",
        },
        401: {"model": ErrorEnvelope, "description": "Bearer token отсутствует или некорректен."},
        403: {"model": ErrorEnvelope, "description": "Пользователь не имеет доступа к этому stage instance."},
        404: {"model": ErrorEnvelope, "description": "Workflow stage instance не найден."},
        413: {"model": ErrorEnvelope, "description": "Файл больше лимита `FILE_MAX_UPLOAD_BYTES`."},
    },
)
def upload_stage_attachment(
    stage_instance_id: Annotated[
        UUID,
        Path(description="Id workflow stage instance, к которому будет привязан attachment."),
    ],
    request: Request,
    file: UploadFile = File(
        ...,
        description=(
            "Binary content attachment. Разрешенные extensions и MIME types: "
            "PDF `application/pdf`, DOCX "
            "`application/vnd.openxmlformats-officedocument.wordprocessingml.document`, XLSX "
            "`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`."
        ),
    ),
    description: str | None = Form(default=None, description="Опциональное описание attachment."),
    attachment_kind: str | None = Form(default=None, description="Business kind of attachment."),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    _ensure_can_access_stage_instance(db, current_user, stage_instance_id)
    attachment = FileService(db).upload_workflow_attachment(
        stage_instance_id=stage_instance_id,
        upload=file,
        uploaded_by=current_user.id,
        description=description,
        attachment_kind=attachment_kind,
        request_id=get_request_id(request),
    )
    return _attachment_read(db, attachment)


@router.get(
    "/stage-instances/{stage_instance_id}/attachments",
    response_model=list[WorkflowAttachmentRead],
    summary="Получить active attachments workflow stage",
    description=(
        "Возвращает active attachments для workflow stage instance. Soft-deleted и purged files исключаются. "
        "Доступ проверяется через interaction, связанный со stage instance."
    ),
    response_description="Active workflow attachments для stage instance.",
    responses={
        401: {"model": ErrorEnvelope, "description": "Bearer token отсутствует или некорректен."},
        403: {"model": ErrorEnvelope, "description": "Пользователь не имеет доступа к этому stage instance."},
        404: {"model": ErrorEnvelope, "description": "Workflow stage instance не найден."},
    },
)
def list_stage_attachments(
    stage_instance_id: Annotated[
        UUID,
        Path(description="Id workflow stage instance, для которого возвращаются active attachments."),
    ],
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    _ensure_can_access_stage_instance(db, current_user, stage_instance_id)
    attachments = FileService(db).list_workflow_attachments(stage_instance_id=stage_instance_id)
    return [_attachment_read(db, attachment) for attachment in attachments]


@router.get(
    "/attachments/{attachment_id}/download",
    summary="Скачать workflow attachment",
    description=(
        "Отдает active workflow attachment stream через backend. Bucket не public; "
        "backend проверяет interaction data scope перед чтением object из S3-compatible storage. "
        "Soft-deleted или purged files возвращают 404."
    ),
    response_description="Binary file stream.",
    responses={
        200: {
            "description": "Binary content файла.",
            "content": {
                "application/pdf": {"schema": {"type": "string", "format": "binary"}},
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
                    "schema": {"type": "string", "format": "binary"}
                },
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
                    "schema": {"type": "string", "format": "binary"}
                },
                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}},
            },
        },
        401: {"model": ErrorEnvelope, "description": "Bearer token отсутствует или некорректен."},
        403: {"model": ErrorEnvelope, "description": "Пользователь не имеет доступа к этому attachment."},
        404: {"model": ErrorEnvelope, "description": "Workflow attachment или file не найден."},
        409: {"model": ErrorEnvelope, "description": "File storage metadata некорректна."},
    },
)
def download_stage_attachment(
    attachment_id: Annotated[UUID, Path(description="Id workflow attachment для download.")],
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    service = FileService(db)
    attachment = service.get_active_attachment(attachment_id)
    _ensure_can_access_attachment(db, current_user, attachment)
    file_record = service.get_file(attachment.file_id)
    download_name = file_record.original_name.replace('"', "").replace("\r", "").replace("\n", "")
    headers = {"Content-Disposition": f'attachment; filename="{download_name}"'}
    return StreamingResponse(
        service.stream_file(
            file_record=file_record,
            actor_user_id=current_user.id,
            request_id=get_request_id(request),
        ),
        media_type=file_record.mime_type or "application/octet-stream",
        headers=headers,
    )


@router.delete(
    "/attachments/{attachment_id}",
    response_model=WorkflowAttachmentRead,
    summary="Soft delete workflow attachment",
    description=(
        "Выполняет soft delete файла workflow attachment. Object остается в S3-compatible storage до истечения retention; "
        "в `files` выставляются `deleted_at`, `delete_after` и `deleted_by`. Обычные list/download endpoints перестают "
        "возвращать attachment после этой операции. Записывается audit event `file.delete`."
    ),
    response_description="Metadata soft-deleted workflow attachment.",
    responses={
        401: {"model": ErrorEnvelope, "description": "Bearer token отсутствует или некорректен."},
        403: {"model": ErrorEnvelope, "description": "Пользователь не имеет доступа к этому attachment."},
        404: {"model": ErrorEnvelope, "description": "Workflow attachment или file не найден."},
    },
)
def delete_stage_attachment(
    attachment_id: Annotated[UUID, Path(description="Id workflow attachment для soft delete.")],
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    service = FileService(db)
    attachment = service.get_active_attachment(attachment_id)
    _ensure_can_access_attachment(db, current_user, attachment)
    attachment = service.soft_delete_attachment(
        attachment_id=attachment_id,
        deleted_by=current_user.id,
        request_id=get_request_id(request),
    )
    return _attachment_read(db, attachment)


@router.post(
    "/attachments/{attachment_id}/restore",
    response_model=WorkflowAttachmentRead,
    summary="Восстановить soft-deleted workflow attachment",
    description=(
        "Восстанавливает soft-deleted workflow attachment до physical purge. "
        "Backend очищает `deleted_at`, `delete_after` и `deleted_by`; исходный object key не меняется. "
        "Purged files восстановить нельзя. Записывается audit event `file.restore`."
    ),
    response_description="Metadata восстановленного workflow attachment.",
    responses={
        401: {"model": ErrorEnvelope, "description": "Bearer token отсутствует или некорректен."},
        403: {"model": ErrorEnvelope, "description": "Пользователь не имеет доступа к этому attachment."},
        404: {"model": ErrorEnvelope, "description": "Workflow attachment или file не найден."},
        409: {"model": ErrorEnvelope, "description": "Purged file нельзя восстановить."},
    },
)
def restore_stage_attachment(
    attachment_id: Annotated[UUID, Path(description="Id workflow attachment для restore.")],
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    service = FileService(db)
    attachment = service.get_attachment(attachment_id)
    _ensure_can_access_attachment(db, current_user, attachment)
    attachment = service.restore_attachment(
        attachment_id=attachment_id,
        restored_by=current_user.id,
        request_id=get_request_id(request),
    )
    return _attachment_read(db, attachment)


@router.get("/transition-history", response_model=Page[WorkflowTransitionHistoryRead])
def list_transition_history(
    interaction_id: UUID | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    if interaction_id is None and not is_admin(current_user):
        raise forbidden("interaction_id is required for this role")
    if interaction_id is not None:
        _ensure_can_access_interaction(db, current_user, interaction_id)
    result = WorkflowRuntimeService(db).list_transition_history(
        interaction_id=interaction_id,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.post("/interactions/{interaction_id}/transition", response_model=WorkflowTransitionResult)
def execute_transition(
    interaction_id: UUID,
    payload: WorkflowTransitionExecute,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    _ensure_can_access_interaction(db, current_user, interaction_id)
    scoped_payload = payload.model_copy(update={"performed_by": current_user.id})
    return WorkflowRuntimeService(db).execute_transition(
        interaction_id,
        scoped_payload,
        request_id=get_request_id(request),
    )

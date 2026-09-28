from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.errors import get_request_id
from app.core.database import get_db_session
from app.modules.auth.access import ADMIN_ROLES, CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.documents.file_service import FileService
from app.modules.documents.model import DocumentTemplate
from app.modules.documents.schemas import DocumentTemplateCreate, DocumentTemplateRead, DocumentTemplateUpdate
from app.modules.users.model import User

router = APIRouter(prefix="/documents", tags=["documents"])
template_router = APIRouter(
    prefix="/document-templates",
    tags=["documents"],
    dependencies=[Depends(require_roles(*CRM_ROLES))],
)


def _read(template: DocumentTemplate) -> DocumentTemplateRead:
    return DocumentTemplateRead(
        id=template.id,
        kind=template.kind,
        name=template.name,
        file_id=template.file_id,
        external_url=template.external_url,
        download_url=f"/api/document-templates/{template.id}/download",
        is_active=template.is_active,
    )


@template_router.get("", response_model=list[DocumentTemplateRead])
def list_document_templates(active_only: bool = True, db: Session = Depends(get_db_session)):
    statement = select(DocumentTemplate).order_by(DocumentTemplate.name)
    if active_only:
        statement = statement.where(DocumentTemplate.is_active.is_(True))
    return [_read(item) for item in db.scalars(statement).all()]


@template_router.post("", response_model=DocumentTemplateRead, status_code=201)
def create_document_template(
    payload: DocumentTemplateCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    if payload.file_id is not None:
        FileService(db).get_file(payload.file_id)
    template = DocumentTemplate(**payload.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return _read(template)


@template_router.patch("/{template_id}", response_model=DocumentTemplateRead)
def update_document_template(
    template_id: UUID,
    payload: DocumentTemplateUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    template = db.get(DocumentTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Document template not found")
    values = payload.model_dump(exclude_unset=True)
    if values.get("file_id") is not None:
        FileService(db).get_file(values["file_id"])
    for field, value in values.items():
        setattr(template, field, value)
    if template.file_id is None and template.external_url is None:
        raise HTTPException(status_code=422, detail="file_id or external_url is required")
    db.commit()
    db.refresh(template)
    return _read(template)


@template_router.get("/{template_id}/download")
def download_document_template(
    template_id: UUID,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    template = db.get(DocumentTemplate, template_id)
    if template is None or not template.is_active:
        raise HTTPException(status_code=404, detail="Document template not found")
    if template.file_id is None:
        if template.external_url is None:
            raise HTTPException(status_code=409, detail="Document template source is missing")
        return RedirectResponse(template.external_url)
    service = FileService(db)
    file_record = service.get_file(template.file_id)
    download_name = file_record.original_name.replace('"', "").replace("\r", "").replace("\n", "")
    return StreamingResponse(
        service.stream_file(
            file_record=file_record,
            actor_user_id=current_user.id,
            request_id=get_request_id(request),
        ),
        media_type=file_record.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
    )

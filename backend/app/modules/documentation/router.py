from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.modules.auth.access import ADMIN_ROLES, CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.documentation.schemas import DocumentationImageRead, DocumentationPageCreate, DocumentationPageRead, DocumentationPageUpdate, DocumentationRequestCreate, DocumentationRequestRead, DocumentationRequestUpdate
from app.modules.documentation.service import DocumentationService
from app.modules.users.model import User

router = APIRouter(prefix="/documentation", tags=["documentation"])

@router.get("/pages", response_model=list[DocumentationPageRead], dependencies=[Depends(require_roles(*CRM_ROLES))])
def list_pages(db: Session = Depends(get_db_session)):
    return DocumentationService(db).tree()

@router.get("/pages/for-route", response_model=DocumentationPageRead | None, dependencies=[Depends(require_roles(*CRM_ROLES))])
def page_for_route(route: str, db: Session = Depends(get_db_session)):
    return DocumentationService(db).by_route(route)

@router.post("/pages", response_model=DocumentationPageRead, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def create_page(payload: DocumentationPageCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*ADMIN_ROLES))):
    return DocumentationService(db).create(payload, current_user)

@router.patch("/pages/{page_id}", response_model=DocumentationPageRead, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def update_page(page_id: UUID, payload: DocumentationPageUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*ADMIN_ROLES))):
    return DocumentationService(db).update(page_id, payload, current_user)

@router.delete("/pages/{page_id}", status_code=204, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def delete_page(page_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*ADMIN_ROLES))):
    DocumentationService(db).delete(page_id, current_user)

@router.post("/pages/{page_id}/upload", response_model=DocumentationPageRead, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def upload_page(page_id: UUID, file: UploadFile = File(...), db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*ADMIN_ROLES))):
    return DocumentationService(db).upload_markdown(page_id, file, current_user)

@router.post("/pages/{page_id}/images", response_model=DocumentationImageRead, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def upload_image(page_id: UUID, file: UploadFile = File(...), db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*ADMIN_ROLES))):
    image = DocumentationService(db).upload_image(page_id, file, current_user)
    return {"id": image.id, "file_id": image.file_id, "markdown": f"![{file.filename or 'image'}](doc-image://{image.id})"}

@router.get("/pages/{page_id}/images/{image_id}", dependencies=[Depends(require_roles(*CRM_ROLES))])
def download_image(page_id: UUID, image_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    file_record = DocumentationService(db).get_image_file(page_id, image_id)
    from app.modules.documents.file_service import FileService
    return StreamingResponse(FileService(db).stream_file(file_record=file_record, actor_user_id=current_user.id), media_type=file_record.mime_type)

@router.post("/requests", response_model=DocumentationRequestRead, dependencies=[Depends(require_roles(*CRM_ROLES))])
def create_request(payload: DocumentationRequestCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return DocumentationService(db).create_request(payload, current_user)

@router.get("/requests", response_model=list[DocumentationRequestRead], dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def list_requests(db: Session = Depends(get_db_session)):
    return DocumentationService(db).requests()

@router.patch("/requests/{request_id}", response_model=DocumentationRequestRead, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def update_request(request_id: UUID, payload: DocumentationRequestUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*ADMIN_ROLES))):
    return DocumentationService(db).update_request(request_id, payload.status, current_user)

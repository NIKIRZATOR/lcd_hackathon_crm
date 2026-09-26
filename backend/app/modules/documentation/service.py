from hashlib import sha256
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.audit.model import AuditEvent
from app.modules.documentation.model import DocumentationImage, DocumentationPage, DocumentationRequest
from app.modules.documents.model import File
from app.modules.users.model import User
from app.storage import get_storage_adapter


class DocumentationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def tree(self) -> list[DocumentationPage]:
        return list(self.db.scalars(select(DocumentationPage).order_by(DocumentationPage.sort_order, DocumentationPage.title)).all())

    def by_route(self, route: str) -> DocumentationPage | None:
        pages = self.tree()
        matches = [page for page in pages if route == page.route_pattern or route.startswith(f"{page.route_pattern}/")]
        return max(matches, key=lambda page: len(page.route_pattern), default=None)

    def get(self, page_id: UUID) -> DocumentationPage:
        page = self.db.get(DocumentationPage, page_id)
        if page is None:
            raise HTTPException(status_code=404, detail="Documentation page not found")
        return page

    def create(self, payload, actor: User) -> DocumentationPage:
        page = DocumentationPage(**payload.model_dump())
        self.db.add(page)
        self._commit_audit(actor.id, "documentation.page.created", "documentation_page", page)
        return page

    def update(self, page_id: UUID, payload, actor: User) -> DocumentationPage:
        page = self.get(page_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(page, field, value)
        self._commit_audit(actor.id, "documentation.page.updated", "documentation_page", page)
        return page

    def delete(self, page_id: UUID, actor: User) -> None:
        page = self.get(page_id)
        for child in self.db.scalars(select(DocumentationPage).where(DocumentationPage.parent_id == page.id)):
            child.parent_id = None
        for request in self.db.scalars(select(DocumentationRequest).where(DocumentationRequest.page_id == page.id)):
            request.page_id = None
        self.db.add(AuditEvent(actor_user_id=actor.id, action="documentation.page.deleted", entity_type="documentation_page", entity_id=page.id))
        self.db.delete(page)
        self.db.commit()

    def upload_markdown(self, page_id: UUID, upload: UploadFile, actor: User) -> DocumentationPage:
        page = self.get(page_id)
        name = Path(upload.filename or "").name
        if not name.lower().endswith((".md", ".markdown")):
            raise HTTPException(status_code=422, detail="Only Markdown files are supported")
        content = upload.file.read()
        try:
            markdown = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=422, detail="Markdown must be UTF-8") from exc
        if not markdown.strip():
            raise HTTPException(status_code=422, detail="Markdown file is empty")
        key = f"documentation/{page.id}/{uuid4()}.md"
        storage = get_storage_adapter()
        storage.put(bucket=settings.s3_bucket_documentation, object_key=key, data=__import__("io").BytesIO(content), length=len(content), content_type="text/markdown; charset=utf-8")
        record = File(original_name=name, storage_name=key.rsplit("/", 1)[-1], storage_path=f"{settings.s3_bucket_documentation}/{key}", mime_type="text/markdown", extension="md", size_bytes=len(content), checksum=sha256(content).hexdigest(), provider="S3", bucket=settings.s3_bucket_documentation, object_key=key, attachment_kind="documentation_markdown", uploaded_by=actor.id)
        self.db.add(record)
        self.db.flush()
        page.content_markdown, page.source_file_id = markdown, record.id
        self._commit_audit(actor.id, "documentation.page.uploaded", "documentation_page", page)
        return page

    def upload_image(self, page_id: UUID, upload: UploadFile, actor: User) -> DocumentationImage:
        page = self.get(page_id)
        name = Path(upload.filename or "").name
        extension = Path(name).suffix.lower()
        allowed = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }
        if extension not in allowed or upload.content_type != allowed[extension]:
            raise HTTPException(status_code=422, detail="Supported image formats: PNG, JPG, WEBP, GIF")
        content = upload.file.read()
        if not content:
            raise HTTPException(status_code=422, detail="Image file is empty")
        if len(content) > settings.file_max_upload_bytes:
            raise HTTPException(status_code=413, detail="Image file is too large")
        object_name = f"{uuid4()}{extension}"
        key = f"documentation/{page.id}/images/{object_name}"
        storage = get_storage_adapter()
        storage.put(bucket=settings.s3_bucket_documentation, object_key=key, data=BytesIO(content), length=len(content), content_type=upload.content_type)
        record = File(original_name=name, storage_name=object_name, storage_path=f"{settings.s3_bucket_documentation}/{key}", mime_type=upload.content_type, extension=extension.lstrip("."), size_bytes=len(content), checksum=sha256(content).hexdigest(), provider="S3", bucket=settings.s3_bucket_documentation, object_key=key, attachment_kind="documentation_image", uploaded_by=actor.id)
        try:
            self.db.add(record)
            self.db.flush()
            image = DocumentationImage(page_id=page.id, file_id=record.id)
            self.db.add(image)
            self.db.flush()
            self._commit_audit(actor.id, "documentation.image.uploaded", "documentation_image", image)
            return image
        except Exception:
            self.db.rollback()
            storage.delete(bucket=settings.s3_bucket_documentation, object_key=key)
            raise

    def get_image_file(self, page_id: UUID, image_id: UUID) -> File:
        image = self.db.get(DocumentationImage, image_id)
        if image is None or image.page_id != page_id:
            raise HTTPException(status_code=404, detail="Documentation image not found")
        file_record = self.db.get(File, image.file_id)
        if file_record is None:
            raise HTTPException(status_code=404, detail="Documentation image file not found")
        return file_record

    def create_request(self, payload, actor: User) -> DocumentationRequest:
        if payload.page_id is not None:
            self.get(payload.page_id)
        request = DocumentationRequest(**payload.model_dump(), author_user_id=actor.id)
        self.db.add(request)
        self._commit_audit(actor.id, "documentation.request.created", "documentation_request", request)
        return request

    def requests(self) -> list[DocumentationRequest]:
        rows = self.db.execute(
            select(DocumentationRequest, User.full_name)
            .join(User, User.id == DocumentationRequest.author_user_id)
            .order_by(DocumentationRequest.created_at.desc())
        ).all()
        return [
            {
                "id": request.id,
                "page_id": request.page_id,
                "author_user_id": request.author_user_id,
                "author_name": author_name,
                "subject": request.subject,
                "message": request.message,
                "status": request.status,
                "created_at": request.created_at,
            }
            for request, author_name in rows
        ]

    def update_request(self, request_id: UUID, status: str, actor: User) -> DocumentationRequest:
        request = self.db.get(DocumentationRequest, request_id)
        if request is None:
            raise HTTPException(status_code=404, detail="Documentation request not found")
        request.status = status
        self._commit_audit(actor.id, "documentation.request.updated", "documentation_request", request)
        return request

    def _commit_audit(self, actor_id: UUID, action: str, entity_type: str, entity) -> None:
        self.db.flush()
        self.db.add(AuditEvent(actor_user_id=actor_id, action=action, entity_type=entity_type, entity_id=entity.id))
        self.db.commit()
        self.db.refresh(entity)

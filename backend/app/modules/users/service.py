from datetime import datetime, timedelta, timezone
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.users.model import ManagerMembership, Role, User
from app.modules.users.repository import ManagerMembershipRepository, UserRepository
from app.modules.users.schemas import ManagerMembershipCreate, ManagerMembershipUpdate
from app.core.config import settings
from app.modules.documents.model import File
from app.storage import get_storage_adapter


SUPPORTED_AUTH_ROLES = {"KAM", "MANAGER", "ADMIN"}
AVATAR_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = UserRepository(db)

    def sync_keycloak_user(
        self,
        *,
        keycloak_user_id: UUID,
        username: str,
        email: str | None,
        full_name: str | None,
        roles: set[str],
    ) -> User:
        auth_roles = roles & SUPPORTED_AUTH_ROLES
        local_roles = self._get_or_create_roles(auth_roles)
        primary_role = local_roles[0].name if local_roles else "USER"

        user = self.repository.get_by_keycloak_user_id(keycloak_user_id)
        if user is None:
            user = self.repository.get_by_username(username)
        if user is None:
            user = User(
                keycloak_user_id=keycloak_user_id,
                username=username,
                full_name=full_name or username,
                email=email,
                role=primary_role,
                is_active=True,
                roles=local_roles,
            )
            self.repository.add_user(user)
        else:
            user.keycloak_user_id = keycloak_user_id
            user.username = username
            user.full_name = full_name or user.full_name or username
            user.email = email
            user.role = primary_role
            user.roles = local_roles

        self.db.commit()
        self.db.refresh(user)
        return user

    def _get_or_create_roles(self, names: set[str]) -> list[Role]:
        existing_roles = {role.name: role for role in self.repository.get_roles_by_names(names)}
        missing_names = names - set(existing_roles)
        for name in missing_names:
            role = Role(name=name, description=f"{name} role from Keycloak")
            self.db.add(role)
            existing_roles[name] = role
        self.db.flush()
        return [existing_roles[name] for name in sorted(existing_roles)]

    def list_users(
        self,
        *,
        search: str | None,
        is_active: bool | None,
        role: str | None,
        limit: int,
        offset: int,
    ) -> ListResult[User]:
        return self.repository.list_users(
            search=search,
            is_active=is_active,
            role=role,
            limit=limit,
            offset=offset,
        )

    def set_active(self, user_id: UUID, is_active: bool) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        user.is_active = is_active
        self.db.commit()
        self.db.refresh(user)
        return user

    def avatar_file(self, user: User) -> File:
        if user.avatar_file_id is None:
            raise HTTPException(status_code=404, detail="Avatar not found")
        file_record = self.db.get(File, user.avatar_file_id)
        if (
            file_record is None
            or file_record.attachment_kind != "user_avatar"
            or file_record.deleted_at is not None
            or file_record.purged_at is not None
        ):
            raise HTTPException(status_code=404, detail="Avatar not found")
        return file_record

    def stream_avatar(self, file_record: File):
        if not file_record.bucket or not file_record.object_key:
            raise HTTPException(status_code=409, detail="Avatar storage metadata is missing")
        stream = get_storage_adapter().get_stream(
            bucket=file_record.bucket,
            object_key=file_record.object_key,
        )

        def chunks():
            try:
                while chunk := stream.read(1024 * 1024):
                    yield chunk
            finally:
                close = getattr(stream, "close", None)
                if close is not None:
                    close()

        return chunks()

    def upload_avatar(self, user: User, upload: UploadFile) -> File:
        original_name = Path(upload.filename or "").name
        extension = Path(original_name).suffix.lower()
        expected_content_type = AVATAR_TYPES.get(extension)
        if expected_content_type is None or upload.content_type != expected_content_type:
            raise HTTPException(status_code=422, detail="Supported avatar formats: JPG, PNG, WebP")
        content = upload.file.read()
        if not content:
            raise HTTPException(status_code=422, detail="Avatar file is empty")
        if len(content) > MAX_AVATAR_BYTES:
            raise HTTPException(status_code=413, detail="Avatar file is too large")
        if not self._is_valid_avatar(content, extension):
            raise HTTPException(status_code=422, detail="Avatar file content does not match its format")

        object_name = f"{uuid4()}{extension}"
        bucket = settings.s3_bucket_user_avatars
        object_key = f"users/{user.id}/avatars/{object_name}"
        storage = get_storage_adapter()
        storage.put(
            bucket=bucket,
            object_key=object_key,
            data=BytesIO(content),
            length=len(content),
            content_type=upload.content_type,
        )
        try:
            previous_avatar_id = user.avatar_file_id
            avatar = File(
                original_name=original_name,
                storage_name=object_name,
                storage_path=f"{bucket}/{object_key}",
                mime_type=upload.content_type,
                extension=extension.lstrip("."),
                size_bytes=len(content),
                checksum=sha256(content).hexdigest(),
                provider="S3",
                bucket=bucket,
                object_key=object_key,
                attachment_kind="user_avatar",
                uploaded_by=user.id,
                scan_status="NOT_SCANNED",
            )
            self.db.add(avatar)
            self.db.flush()
            user.avatar_file_id = avatar.id
            self._soft_delete_avatar(previous_avatar_id, user.id)
            self.db.commit()
            self.db.refresh(avatar)
            return avatar
        except Exception:
            self.db.rollback()
            storage.delete(bucket=bucket, object_key=object_key)
            raise

    def delete_avatar(self, user: User) -> None:
        if user.avatar_file_id is None:
            return
        self._soft_delete_avatar(user.avatar_file_id, user.id)
        user.avatar_file_id = None
        self.db.commit()

    def _soft_delete_avatar(self, file_id: UUID | None, actor_user_id: UUID) -> None:
        if file_id is None:
            return
        file_record = self.db.get(File, file_id)
        if file_record is None:
            return
        now = datetime.now(timezone.utc)
        file_record.deleted_at = now
        file_record.delete_after = now + timedelta(days=settings.file_retention_days)
        file_record.deleted_by = actor_user_id

    @staticmethod
    def _is_valid_avatar(content: bytes, extension: str) -> bool:
        if extension == ".png":
            return content.startswith(b"\x89PNG\r\n\x1a\n")
        if extension in {".jpg", ".jpeg"}:
            return content.startswith(b"\xff\xd8\xff")
        return len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP"


class ManagerMembershipService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = ManagerMembershipRepository(db)

    def list_memberships(
        self,
        *,
        manager_user_id: UUID | None,
        kam_user_id: UUID | None,
        is_active: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[ManagerMembership]:
        return self.repository.list(
            manager_user_id=manager_user_id,
            kam_user_id=kam_user_id,
            is_active=is_active,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def create_membership(self, payload: ManagerMembershipCreate) -> ManagerMembership:
        manager = self._get_user_with_role(payload.manager_user_id, "MANAGER", "Manager user not found")
        kam = self._get_user_with_role(payload.kam_user_id, "KAM", "KAM user not found")
        if manager.id == kam.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manager and KAM must be different users")

        membership = self.repository.get_by_pair(payload.manager_user_id, payload.kam_user_id)
        if membership is None:
            membership = ManagerMembership(**payload.model_dump(), is_active=True)
            self.repository.add(membership)
        else:
            membership.valid_from = payload.valid_from
            membership.valid_to = payload.valid_to
            membership.is_active = True

        self.db.commit()
        self.db.refresh(membership)
        return membership

    def update_membership(self, membership_id: UUID, payload: ManagerMembershipUpdate) -> ManagerMembership:
        membership = self._get_membership(membership_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(membership, field, value)
        self.db.commit()
        self.db.refresh(membership)
        return membership

    def deactivate_membership(self, membership_id: UUID) -> ManagerMembership:
        membership = self._get_membership(membership_id)
        membership.is_active = False
        self.db.commit()
        self.db.refresh(membership)
        return membership

    def _get_membership(self, membership_id: UUID) -> ManagerMembership:
        membership = self.repository.get(membership_id)
        if membership is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager membership not found")
        return membership

    def _get_user_with_role(self, user_id: UUID, role: str, not_found_message: str) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=not_found_message)
        if role not in {item.name for item in user.roles}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User must have {role} role")
        return user

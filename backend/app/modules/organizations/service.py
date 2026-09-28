from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session, aliased

from app.common.repository import ListResult
from app.core.config import settings
from app.modules.auth.access import forbidden, get_subordinate_kam_ids, has_any_role, is_admin
from app.modules.audit.model import AuditEvent
from app.modules.documents.model import File
from app.modules.integrations.model import IntegrationSignal, ProgramMetric
from app.modules.licenses.model import Contract, License
from app.modules.nba.model import NbaItem, NbaRule
from app.modules.organizations.model import OrgAssignment, Organization, OrganizationType, Stakeholder
from app.modules.program_instances.model import ProgramInstance
from app.modules.organizations.schemas import AssignmentCreate, OrganizationCreate, OrganizationUpdate, StakeholderCreate, StakeholderUpdate
from app.modules.users.model import Role, User
from app.modules.workflows.model import WorkflowStage, WorkflowStageAttachment, WorkflowStageComment, WorkflowStageInstance, WorkflowTransitionHistory
from app.storage import get_storage_adapter


class OrganizationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(
        self,
        current_user: User,
        search: str | None,
        limit: int,
        offset: int,
        unassigned_only: bool = False,
    ) -> ListResult[dict]:
        statement = select(Organization)
        if unassigned_only and not is_admin(current_user):
            raise forbidden("Only ADMIN can filter unassigned organizations")
        if not is_admin(current_user):
            kam_ids = get_subordinate_kam_ids(self.db, current_user.id) if has_any_role(current_user, "MANAGER") else {current_user.id}
            statement = statement.where(exists().where(OrgAssignment.organization_id == Organization.id, OrgAssignment.user_id.in_(kam_ids), OrgAssignment.status == "active"))
        if search:
            statement = statement.where(Organization.name.ilike(f"%{search}%"))
        if unassigned_only:
            statement = statement.where(
                ~exists().where(
                    OrgAssignment.organization_id == Organization.id,
                    OrgAssignment.status == "active",
                )
            )
        total = self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0
        organizations = list(self.db.scalars(statement.order_by(Organization.name).limit(limit).offset(offset)).all())
        return ListResult([self._list_row(organization) for organization in organizations], total)

    def get(self, organization_id: UUID, current_user: User) -> Organization:
        organization = self.db.get(Organization, organization_id)
        if organization is None:
            raise HTTPException(status_code=404, detail="Organization not found")
        if not is_admin(current_user):
            kam_ids = get_subordinate_kam_ids(self.db, current_user.id) if has_any_role(current_user, "MANAGER") else {current_user.id}
            visible = self.db.scalar(select(exists().where(OrgAssignment.organization_id == organization_id, OrgAssignment.user_id.in_(kam_ids), OrgAssignment.status == "active")))
            if not visible:
                raise HTTPException(status_code=403, detail="Cannot access this organization")
        return organization

    def logo_file(self, organization_id: UUID, current_user: User) -> File:
        organization = self.get(organization_id, current_user)
        if organization.logo_file_id is None:
            raise HTTPException(status_code=404, detail="Organization logo not found")
        file_record = self.db.get(File, organization.logo_file_id)
        if (
            file_record is None
            or file_record.attachment_kind != "organization_logo"
            or file_record.deleted_at is not None
            or file_record.purged_at is not None
        ):
            raise HTTPException(status_code=404, detail="Organization logo not found")
        return file_record

    def upload_logo(self, organization_id: UUID, upload: UploadFile, current_user: User) -> Organization:
        organization = self.get(organization_id, current_user)
        original_name = Path(upload.filename or "").name
        extension = Path(original_name).suffix.lower()
        allowed_types = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
        if extension not in allowed_types or upload.content_type != allowed_types[extension]:
            raise HTTPException(status_code=422, detail="Supported logo formats: PNG, JPG")

        content = upload.file.read()
        if not content:
            raise HTTPException(status_code=422, detail="Logo file is empty")
        if len(content) > settings.file_max_upload_bytes:
            raise HTTPException(status_code=413, detail="Logo file is too large")

        object_name = f"{uuid4()}{extension}"
        bucket = settings.s3_bucket_organization_logos
        object_key = f"organizations/{organization.id}/logos/{object_name}"
        storage = get_storage_adapter()
        storage.put(
            bucket=bucket,
            object_key=object_key,
            data=BytesIO(content),
            length=len(content),
            content_type=upload.content_type,
        )
        try:
            previous_logo_id = organization.logo_file_id
            logo = File(
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
                attachment_kind="organization_logo",
                uploaded_by=current_user.id,
                scan_status="NOT_SCANNED",
            )
            self.db.add(logo)
            self.db.flush()
            organization.logo_file_id = logo.id
            self._soft_delete_logo(previous_logo_id, current_user.id)
            self.db.add(AuditEvent(
                actor_user_id=current_user.id,
                action="organization.logo.uploaded",
                entity_type="organization",
                entity_id=organization.id,
                event_metadata={"file_id": str(logo.id), "replaced_file_id": str(previous_logo_id) if previous_logo_id else None},
            ))
            self.db.commit()
            self.db.refresh(organization)
            return organization
        except Exception:
            self.db.rollback()
            storage.delete(bucket=bucket, object_key=object_key)
            raise

    def delete_logo(self, organization_id: UUID, current_user: User) -> None:
        organization = self.get(organization_id, current_user)
        logo_id = organization.logo_file_id
        if logo_id is None:
            raise HTTPException(status_code=404, detail="Organization logo not found")
        organization.logo_file_id = None
        self._soft_delete_logo(logo_id, current_user.id)
        self.db.add(AuditEvent(
            actor_user_id=current_user.id,
            action="organization.logo.deleted",
            entity_type="organization",
            entity_id=organization.id,
            event_metadata={"file_id": str(logo_id)},
        ))
        self.db.commit()

    def _soft_delete_logo(self, logo_id: UUID | None, actor_user_id: UUID) -> None:
        if logo_id is None:
            return
        logo = self.db.get(File, logo_id)
        if logo is None:
            return
        now = datetime.now(timezone.utc)
        logo.deleted_at = now
        logo.delete_after = now + timedelta(days=settings.file_retention_days)
        logo.deleted_by = actor_user_id

    def create(self, payload: OrganizationCreate, current_user: User) -> Organization:
        if not is_admin(current_user):
            raise HTTPException(status_code=403, detail="Only ADMIN can create organizations")
        if self.db.get(OrganizationType, payload.type_id) is None:
            raise HTTPException(status_code=422, detail="Organization type not found")
        kam_id = payload.kam_user_id
        if kam_id is not None:
            kam_user = self.db.get(User, kam_id)
            if kam_user is None or not has_any_role(kam_user, "KAM"):
                raise HTTPException(status_code=422, detail="Organization must be assigned to a KAM user")
        organization = Organization(**payload.model_dump(exclude={"kam_user_id"}))
        self.db.add(organization)
        self.db.flush()
        if kam_id is not None:
            self._assign(organization.id, kam_id, current_user.id)
        self.db.commit()
        self.db.refresh(organization)
        return organization

    def update(self, organization_id: UUID, payload: OrganizationUpdate, current_user: User) -> Organization:
        organization = self.get(organization_id, current_user)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(organization, field, value)
        self.db.commit()
        self.db.refresh(organization)
        return organization

    def assign(self, organization_id: UUID, payload: AssignmentCreate, current_user: User) -> OrgAssignment:
        if not (is_admin(current_user) or has_any_role(current_user, "MANAGER")):
            raise HTTPException(status_code=403, detail="Only MANAGER or ADMIN can assign KAM")
        self.get(organization_id, current_user)
        kam_user = self.db.get(User, payload.kam_user_id)
        if kam_user is None or not has_any_role(kam_user, "KAM"):
            raise HTTPException(status_code=422, detail="Organization must be assigned to a KAM user")
        if has_any_role(current_user, "MANAGER") and payload.kam_user_id not in get_subordinate_kam_ids(self.db, current_user.id):
            raise HTTPException(status_code=403, detail="KAM is outside manager scope")
        now = datetime.now(timezone.utc)
        for assignment in self.db.scalars(select(OrgAssignment).where(OrgAssignment.organization_id == organization_id, OrgAssignment.status == "active")):
            assignment.status, assignment.ended_at = "ended", now
        assignment = self._assign(organization_id, payload.kam_user_id, current_user.id, now)
        self.db.add(AuditEvent(actor_user_id=current_user.id, action="organization.kam_reassigned", entity_type="organization", entity_id=organization_id, reason=payload.reason, event_metadata={"new_kam_user_id": str(payload.kam_user_id)}))
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def assignment_history(self, organization_id: UUID, current_user: User) -> list[dict]:
        self.get(organization_id, current_user)
        assigned_by = aliased(User)
        rows = self.db.execute(
            select(OrgAssignment, User.full_name, assigned_by.full_name)
            .join(User, User.id == OrgAssignment.user_id)
            .outerjoin(assigned_by, assigned_by.id == OrgAssignment.assigned_by)
            .where(OrgAssignment.organization_id == organization_id)
            .order_by(OrgAssignment.assigned_at.desc())
        ).all()
        return [
            {
                **{field: getattr(assignment, field) for field in OrgAssignment.__table__.columns.keys()},
                "kam_name": kam_name,
                "assigned_by_name": assigned_by_name,
            }
            for assignment, kam_name, assigned_by_name in rows
        ]

    def stakeholders(self, organization_id: UUID, current_user: User) -> list[Stakeholder]:
        self.get(organization_id, current_user)
        return list(self.db.scalars(select(Stakeholder).where(Stakeholder.organization_id == organization_id).order_by(Stakeholder.is_active.desc(), Stakeholder.full_name)).all())

    def summary_360(self, organization_id: UUID, current_user: User) -> dict[str, object]:
        organization = self.get(organization_id, current_user)
        type_name = self.db.scalar(select(OrganizationType.name).where(OrganizationType.id == organization.type_id))
        kam_name = self.db.scalar(
            select(User.full_name)
            .join(OrgAssignment, OrgAssignment.user_id == User.id)
            .where(OrgAssignment.organization_id == organization.id, OrgAssignment.status == "active")
        )
        documents_count = (self.db.scalar(select(func.count()).select_from(Contract).where(Contract.organization_id == organization.id, Contract.attachment_id.is_not(None))) or 0) + (self.db.scalar(select(func.count()).select_from(License).join(ProgramInstance).where(ProgramInstance.organization_id == organization.id, License.attachment_id.is_not(None))) or 0)
        feed_events_count = self.db.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.entity_id == organization.id)) or 0
        return {"id": organization.id, "type_name": type_name or "—", "kam_name": kam_name, "documents_count": documents_count, "feed_events_count": feed_events_count}

    def eligible_kams(self, organization_id: UUID, current_user: User) -> list[User]:
        self.get(organization_id, current_user)
        if has_any_role(current_user, "KAM") and not (
            is_admin(current_user) or has_any_role(current_user, "MANAGER")
        ):
            return [current_user]
        if is_admin(current_user):
            return list(self.db.scalars(select(User).join(User.roles).where(Role.name == "KAM", User.is_active.is_(True)).order_by(User.full_name)).all())
        if has_any_role(current_user, "MANAGER"):
            return list(self.db.scalars(select(User).where(User.id.in_(get_subordinate_kam_ids(self.db, current_user.id)), User.is_active.is_(True)).order_by(User.full_name)).all())
        raise forbidden("Only CRM roles can list eligible KAMs")

    def documents(self, organization_id: UUID, current_user: User) -> list[dict]:
        self.get(organization_id, current_user)
        rows = self.db.execute(
            select(WorkflowStageAttachment, File, WorkflowStageInstance, WorkflowStage, ProgramInstance, User.full_name)
            .join(File, File.id == WorkflowStageAttachment.file_id)
            .join(WorkflowStageInstance, WorkflowStageInstance.id == WorkflowStageAttachment.stage_instance_id)
            .join(WorkflowStage, WorkflowStage.id == WorkflowStageInstance.workflow_stage_id)
            .join(ProgramInstance, ProgramInstance.id == WorkflowStageInstance.program_instance_id)
            .join(User, User.id == WorkflowStageAttachment.uploaded_by)
            .where(ProgramInstance.organization_id == organization_id, File.deleted_at.is_(None), File.purged_at.is_(None))
            .order_by(WorkflowStageAttachment.created_at.desc())
        ).all()
        return [{"file_id": file.id, "attachment_id": attachment.id, "filename": file.original_name, "kind": file.attachment_kind, "program_name": program.id.hex[:8], "stage_name": stage.name, "created_at": attachment.created_at, "uploaded_by_name": uploaded_by} for attachment, file, _, stage, program, uploaded_by in rows]

    def feed(self, organization_id: UUID, current_user: User) -> list[dict]:
        self.get(organization_id, current_user)
        program_ids = list(self.db.scalars(select(ProgramInstance.id).where(ProgramInstance.organization_id == organization_id)).all())
        items: list[dict] = []
        if program_ids:
            transitions = self.db.execute(select(WorkflowTransitionHistory, User.full_name).join(User, User.id == WorkflowTransitionHistory.performed_by).where(WorkflowTransitionHistory.program_instance_id.in_(program_ids))).all()
            items.extend({"id": str(event.id), "kind": "transition", "title": "Переход этапа", "description": event.comment, "created_at": event.performed_at or event.created_at, "actor_name": actor} for event, actor in transitions)
            comments = self.db.execute(select(WorkflowStageComment, User.full_name).join(User, User.id == WorkflowStageComment.author_user_id).join(WorkflowStageInstance, WorkflowStageInstance.id == WorkflowStageComment.stage_instance_id).where(WorkflowStageInstance.program_instance_id.in_(program_ids), WorkflowStageComment.deleted_at.is_(None))).all()
            items.extend({"id": str(event.id), "kind": "comment", "title": "Комментарий", "description": event.text, "created_at": event.created_at, "actor_name": actor} for event, actor in comments)
            attachments = self.db.execute(select(WorkflowStageAttachment, File, User.full_name).join(File, File.id == WorkflowStageAttachment.file_id).join(User, User.id == WorkflowStageAttachment.uploaded_by).join(WorkflowStageInstance, WorkflowStageInstance.id == WorkflowStageAttachment.stage_instance_id).where(WorkflowStageInstance.program_instance_id.in_(program_ids), File.deleted_at.is_(None))).all()
            items.extend({"id": str(event.id), "kind": "file", "title": "Загружен файл", "description": file.original_name, "created_at": event.created_at, "actor_name": actor} for event, file, actor in attachments)
            signals = self.db.scalars(select(IntegrationSignal).where(IntegrationSignal.program_instance_id.in_(program_ids)).order_by(IntegrationSignal.created_at.desc())).all()
            items.extend({"id": str(event.id), "kind": "integration", "title": f"Интеграция: {event.source}", "description": event.error_message or event.status, "created_at": event.created_at, "actor_name": None} for event in signals)
        audit = self.db.execute(select(AuditEvent, User.full_name).outerjoin(User, User.id == AuditEvent.actor_user_id).where((AuditEvent.entity_id == organization_id) | (AuditEvent.entity_id.in_(program_ids) if program_ids else False)).order_by(AuditEvent.created_at.desc()).limit(100)).all()
        items.extend({"id": str(event.id), "kind": "audit", "title": event.action, "description": event.reason, "created_at": event.created_at, "actor_name": actor} for event, actor in audit)
        return sorted(items, key=lambda item: item["created_at"], reverse=True)[:100]

    def add_stakeholder(self, organization_id: UUID, payload: StakeholderCreate, current_user: User) -> Stakeholder:
        self.get(organization_id, current_user)
        if payload.program_instance_id is not None:
            program = self.db.get(ProgramInstance, payload.program_instance_id)
            if program is None or program.organization_id != organization_id:
                raise HTTPException(status_code=422, detail="Program does not belong to organization")
        if payload.is_primary:
            self._clear_primary(organization_id)
        stakeholder = Stakeholder(organization_id=organization_id, **payload.model_dump())
        self.db.add(stakeholder)
        self.db.commit()
        self.db.refresh(stakeholder)
        return stakeholder

    def update_stakeholder(self, stakeholder_id: UUID, payload: StakeholderUpdate, current_user: User) -> Stakeholder:
        stakeholder = self.db.get(Stakeholder, stakeholder_id)
        if stakeholder is None:
            raise HTTPException(status_code=404, detail="Stakeholder not found")
        self.get(stakeholder.organization_id, current_user)
        values = payload.model_dump(exclude_unset=True)
        program_id = values.get("program_instance_id")
        if program_id is not None:
            program = self.db.get(ProgramInstance, program_id)
            if program is None or program.organization_id != stakeholder.organization_id:
                raise HTTPException(status_code=422, detail="Program does not belong to organization")
        if values.get("is_primary"):
            self._clear_primary(stakeholder.organization_id, except_id=stakeholder.id)
        for field, value in values.items():
            setattr(stakeholder, field, value)
        self.db.commit()
        self.db.refresh(stakeholder)
        return stakeholder

    def _list_row(self, organization: Organization) -> dict:
        programs = list(self.db.scalars(select(ProgramInstance).where(ProgramInstance.organization_id == organization.id, ProgramInstance.status.in_(["draft", "active", "paused"]))).all())
        scores = [program.health_score for program in programs if program.health_score is not None]
        worst = min(scores) if scores else None
        worst_band = next((program.health_band for program in programs if program.health_score == worst), None)
        risk = self.db.scalar(select(NbaItem.action).join(NbaRule, NbaRule.id == NbaItem.rule_id).where(NbaItem.organization_id == organization.id, NbaItem.status == "active", NbaRule.code != "next_stage").order_by(NbaItem.due_at.nulls_last(), NbaItem.created_at).limit(1))
        kam_name = self.db.scalar(select(User.full_name).join(OrgAssignment, OrgAssignment.user_id == User.id).where(OrgAssignment.organization_id == organization.id, OrgAssignment.status == "active"))
        type_name = self.db.scalar(select(OrganizationType.name).where(OrganizationType.id == organization.type_id)) or "—"
        return {**{field: getattr(organization, field) for field in Organization.__table__.columns.keys()}, "type_name": type_name, "kam_name": kam_name, "active_programs_count": len(programs), "worst_health_score": worst, "worst_health_band": worst_band, "nearest_risk": risk, "no_activity": bool(programs) and not self.db.scalar(select(ProgramMetric.id).where(ProgramMetric.program_instance_id.in_([program.id for program in programs]), ProgramMetric.teacher_activity_on.is_not(None)).limit(1))}

    def _clear_primary(self, organization_id: UUID, except_id: UUID | None = None) -> None:
        statement = select(Stakeholder).where(Stakeholder.organization_id == organization_id, Stakeholder.is_primary.is_(True))
        if except_id is not None:
            statement = statement.where(Stakeholder.id != except_id)
        for stakeholder in self.db.scalars(statement):
            stakeholder.is_primary = False

    def _assign(self, organization_id: UUID, kam_user_id: UUID, assigned_by: UUID, assigned_at: datetime | None = None) -> OrgAssignment:
        assignment = OrgAssignment(organization_id=organization_id, user_id=kam_user_id, assigned_by=assigned_by, assigned_at=assigned_at or datetime.now(timezone.utc), status="active")
        self.db.add(assignment)
        return assignment

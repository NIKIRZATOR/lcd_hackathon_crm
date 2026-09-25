from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.checklists.model import PlaybookChecklistItem, ProgramChecklistValue
from app.modules.documents.model import File
from app.modules.interactions.model import UniversityInteraction
from app.modules.program_instances.model import ProgramInstance
from app.modules.users.model import User
from app.modules.workflows.model import (
    WorkflowChangeRequest,
    WorkflowMigrationJob,
    WorkflowStage,
    WorkflowStageAttachment,
    WorkflowStageInstance,
    WorkflowStageMapping,
    WorkflowTemplate,
    WorkflowTransition,
    WorkflowTransitionHistory,
    WorkflowVersion,
)
from app.modules.workflows.repository import (
    WorkflowChangeRequestRepository,
    WorkflowMigrationJobRepository,
    WorkflowStageInstanceRepository,
    WorkflowStageMappingRepository,
    WorkflowStageRepository,
    WorkflowTemplateRepository,
    WorkflowTransitionHistoryRepository,
    WorkflowTransitionRepository,
    WorkflowVersionRepository,
)
from app.modules.workflows.schemas import (
    WorkflowAvailableTransitionRead,
    WorkflowDangerousChangeRead,
    WorkflowDangerousChangesRead,
    WorkflowChangeRequestCreate,
    WorkflowChangeRequestReview,
    WorkflowMigrationExecuteRequest,
    WorkflowMigrationPreviewRead,
    WorkflowMigrationPreviewRequest,
    WorkflowStageCreate,
    WorkflowStageInstanceStatusUpdate,
    WorkflowStageRead,
    WorkflowStageUpdate,
    WorkflowTemplateCreate,
    WorkflowTemplateUpdate,
    WorkflowTransitionCreate,
    WorkflowTransitionExecute,
    WorkflowTransitionRead,
    WorkflowTransitionResult,
    WorkflowTransitionUpdate,
    WorkflowStageMappingRead,
)

TERMINAL_INTERACTION_STATUSES = {"COMPLETED", "CANCELLED", "ARCHIVED"}


def workflow_error(
    *,
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "code": code,
            "message": message,
            "details": details,
        },
    )


class WorkflowTemplateService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = WorkflowTemplateRepository(db)

    def list_templates(
        self,
        *,
        search: str | None,
        is_active: bool | None,
        is_default: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[WorkflowTemplate]:
        return self.repository.list(
            filters={"is_active": is_active, "is_default": is_default},
            search=search,
            search_fields=("name", "description", "version"),
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_template(self, template_id: UUID) -> WorkflowTemplate:
        template = self.repository.get(template_id)
        if template is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow template not found",
            )
        return template

    def create_template(self, payload: WorkflowTemplateCreate) -> WorkflowTemplate:
        if (
            payload.created_by is not None
            and self.db.get(User, payload.created_by) is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Template creator not found",
            )
        template = WorkflowTemplate(**payload.model_dump())
        self.repository.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def update_template(
        self, template_id: UUID, payload: WorkflowTemplateUpdate
    ) -> WorkflowTemplate:
        template = self.get_template(template_id)
        if (
            payload.created_by is not None
            and self.db.get(User, payload.created_by) is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Template creator not found",
            )
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(template, field, value)
        self.db.commit()
        self.db.refresh(template)
        return template


class WorkflowVersionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.template_repository = WorkflowTemplateRepository(db)
        self.version_repository = WorkflowVersionRepository(db)
        self.stage_repository = WorkflowStageRepository(db)
        self.transition_repository = WorkflowTransitionRepository(db)
        self.audit_repository = AuditEventRepository(db)
        self.change_request_repository = WorkflowChangeRequestRepository(db)
        self.stage_mapping_repository = WorkflowStageMappingRepository(db)
        self.migration_job_repository = WorkflowMigrationJobRepository(db)

    def list_versions(self, template_id: UUID) -> list[WorkflowVersion]:
        self._get_template(template_id)
        return self.version_repository.list_by_template(template_id)

    def get_current_published_version(self, template_id: UUID) -> WorkflowVersion:
        version = self.version_repository.get_current_published(template_id)
        if version is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow template has no published version",
            )
        return version

    def create_draft(
        self,
        template_id: UUID,
        *,
        created_by: UUID | None,
        request_id: str | None = None,
    ) -> WorkflowVersion:
        self._get_template(template_id)
        existing_draft = self.db.scalar(
            select(WorkflowVersion).where(
                WorkflowVersion.workflow_template_id == template_id,
                WorkflowVersion.status == "DRAFT",
            )
        )
        if existing_draft is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Workflow draft already exists",
            )

        source = self.version_repository.get_current_published(template_id)
        next_version_number = self._get_next_version_number(template_id)
        draft = WorkflowVersion(
            workflow_template_id=template_id,
            version=next_version_number,
            status="DRAFT",
            supersedes_version_id=source.id if source is not None else None,
            created_by=created_by,
        )
        self.version_repository.add(draft)

        if source is not None:
            self._clone_version_structure(source, draft)
        self.audit_repository.add(
            AuditEvent(
                actor_user_id=created_by,
                action="workflow.version.draft_created",
                entity_type="workflow_version",
                entity_id=draft.id,
                event_metadata={
                    "workflow_template_id": str(template_id),
                    "version": draft.version,
                    "supersedes_version_id": str(source.id)
                    if source is not None
                    else None,
                },
                request_id=request_id,
            )
        )

        self.db.commit()
        self.db.refresh(draft)
        return draft

    def publish_version(
        self,
        version_id: UUID,
        *,
        actor_user_id: UUID | None = None,
        request_id: str | None = None,
    ) -> WorkflowVersion:
        version = self.db.get(WorkflowVersion, version_id)
        if version is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow version not found",
            )
        if version.status != "DRAFT":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only draft workflow version can be published",
            )
        stages = self.stage_repository.list_active_by_version(version.id)
        if not stages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow version has no active stages",
            )
        transitions = self.transition_repository.list_by_version(version.id)
        self._validate_publish_graph(version, stages, transitions)

        now = datetime.now(timezone.utc)
        current = self.version_repository.get_current_published(
            version.workflow_template_id
        )
        if current is not None:
            current.status = "ARCHIVED"
            current.archived_at = now

        version.status = "PUBLISHED"
        version.published_at = now
        changes = self.detect_dangerous_changes(version.id)
        approved_request = self.change_request_repository.get_approved_for_version(
            version.id
        )
        if changes.has_dangerous_changes and approved_request is None:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_CHANGE_REQUEST_REQUIRED",
                message="Dangerous workflow changes require approved change request",
                details={
                    "workflowVersionId": str(version.id),
                    "dangerousChangeCount": len(changes.changes),
                },
            )
        self.audit_repository.add(
            AuditEvent(
                actor_user_id=actor_user_id,
                action="workflow.version.published",
                entity_type="workflow_version",
                entity_id=version.id,
                event_metadata={
                    "workflow_template_id": str(version.workflow_template_id),
                    "version": version.version,
                    "archived_version_id": str(current.id)
                    if current is not None
                    else None,
                    "has_dangerous_changes": changes.has_dangerous_changes,
                    "dangerous_change_count": len(changes.changes),
                    "active_interaction_count": changes.active_interaction_count,
                    "change_request_id": str(approved_request.id)
                    if approved_request is not None
                    else None,
                },
                request_id=request_id,
            )
        )
        self.db.commit()
        self.db.refresh(version)
        return version

    def list_change_requests(
        self,
        *,
        workflow_version_id: UUID | None,
        status_value: str | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[WorkflowChangeRequest]:
        return self.change_request_repository.list(
            filters={
                "workflow_version_id": workflow_version_id,
                "status": status_value,
            },
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_change_request(self, change_request_id: UUID) -> WorkflowChangeRequest:
        change_request = self.change_request_repository.get(change_request_id)
        if change_request is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow change request not found",
            )
        return change_request

    def create_change_request(
        self,
        version_id: UUID,
        payload: WorkflowChangeRequestCreate,
        *,
        requested_by: UUID,
        request_id: str | None = None,
    ) -> WorkflowChangeRequest:
        version = self.db.get(WorkflowVersion, version_id)
        if version is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow version not found",
            )
        if version.status != "DRAFT":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only draft workflow version can be reviewed",
            )
        changes = self.detect_dangerous_changes(version.id)
        change_request = WorkflowChangeRequest(
            workflow_version_id=version.id,
            status="PENDING",
            requested_by=requested_by,
            requested_at=datetime.now(timezone.utc),
            reason=payload.reason,
            dangerous_changes_snapshot=changes.model_dump(mode="json"),
        )
        self.change_request_repository.add(change_request)
        self.audit_repository.add(
            AuditEvent(
                actor_user_id=requested_by,
                action="workflow.change_request.created",
                entity_type="workflow_change_request",
                entity_id=change_request.id,
                reason=payload.reason,
                event_metadata={
                    "workflow_version_id": str(version.id),
                    "has_dangerous_changes": changes.has_dangerous_changes,
                    "dangerous_change_count": len(changes.changes),
                },
                request_id=request_id,
            )
        )
        self.db.commit()
        self.db.refresh(change_request)
        return change_request

    def approve_change_request(
        self,
        change_request_id: UUID,
        payload: WorkflowChangeRequestReview,
        *,
        reviewed_by: UUID,
        request_id: str | None = None,
    ) -> WorkflowChangeRequest:
        return self._review_change_request(
            change_request_id,
            payload,
            reviewed_by=reviewed_by,
            new_status="APPROVED",
            audit_action="workflow.change_request.approved",
            request_id=request_id,
        )

    def reject_change_request(
        self,
        change_request_id: UUID,
        payload: WorkflowChangeRequestReview,
        *,
        reviewed_by: UUID,
        request_id: str | None = None,
    ) -> WorkflowChangeRequest:
        return self._review_change_request(
            change_request_id,
            payload,
            reviewed_by=reviewed_by,
            new_status="REJECTED",
            audit_action="workflow.change_request.rejected",
            request_id=request_id,
        )

    def _review_change_request(
        self,
        change_request_id: UUID,
        payload: WorkflowChangeRequestReview,
        *,
        reviewed_by: UUID,
        new_status: str,
        audit_action: str,
        request_id: str | None,
    ) -> WorkflowChangeRequest:
        change_request = self.get_change_request(change_request_id)
        if change_request.status != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only pending change request can be reviewed",
            )
        change_request.status = new_status
        change_request.reviewed_by = reviewed_by
        change_request.reviewed_at = datetime.now(timezone.utc)
        change_request.review_comment = payload.review_comment
        self.audit_repository.add(
            AuditEvent(
                actor_user_id=reviewed_by,
                action=audit_action,
                entity_type="workflow_change_request",
                entity_id=change_request.id,
                reason=payload.review_comment,
                event_metadata={
                    "workflow_version_id": str(change_request.workflow_version_id)
                },
                request_id=request_id,
            )
        )
        self.db.commit()
        self.db.refresh(change_request)
        return change_request

    def preview_migration(
        self,
        target_version_id: UUID,
        payload: WorkflowMigrationPreviewRequest,
    ) -> WorkflowMigrationPreviewRead:
        target_version, source_version = self._get_migration_versions(target_version_id)
        active_interactions = self._list_active_interactions_by_version(
            source_version.id
        )
        mappings = self._resolve_stage_mappings(
            source_version.id, target_version.id, payload.mappings, persist=False
        )
        missing_stage_ids = []
        for interaction in active_interactions:
            source_stage_id = self._get_current_stage_id(interaction)
            if source_stage_id is not None and source_stage_id not in mappings:
                missing_stage_ids.append(source_stage_id)
        return WorkflowMigrationPreviewRead(
            source_version_id=source_version.id,
            target_version_id=target_version.id,
            affected_interaction_count=len(active_interactions),
            can_migrate=not missing_stage_ids,
            missing_stage_mappings=missing_stage_ids,
            stage_mappings=self._stage_mapping_reads(mappings),
        )

    def execute_migration(
        self,
        target_version_id: UUID,
        payload: WorkflowMigrationExecuteRequest,
        *,
        created_by: UUID | None,
        request_id: str | None = None,
    ) -> WorkflowMigrationJob:
        target_version, source_version = self._get_migration_versions(target_version_id)
        if payload.change_request_id is not None:
            change_request = self.get_change_request(payload.change_request_id)
            if (
                change_request.workflow_version_id != target_version.id
                or change_request.status != "APPROVED"
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Approved change request is required",
                )

        preview = self.preview_migration(target_version_id, payload)
        if not preview.can_migrate:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_MIGRATION_MAPPING_REQUIRED",
                message="Missing stage mappings block migration",
                details={
                    "missingStageInstanceIds": [
                        str(stage_id) for stage_id in preview.missing_stage_mappings
                    ]
                },
            )

        now = datetime.now(timezone.utc)
        job = WorkflowMigrationJob(
            source_version_id=source_version.id,
            target_version_id=target_version.id,
            change_request_id=payload.change_request_id,
            status="RUNNING",
            created_by=created_by,
            started_at=now,
            affected_interaction_count=preview.affected_interaction_count,
            migrated_interaction_count=0,
        )
        self.migration_job_repository.add(job)
        mappings = self._resolve_stage_mappings(
            source_version.id, target_version.id, payload.mappings, persist=True
        )
        try:
            for interaction in self._list_active_interactions_by_version(
                source_version.id, lock=True
            ):
                source_stage_id = self._get_current_stage_id(interaction)
                target_stage = mappings.get(source_stage_id)
                if target_stage is None:
                    raise RuntimeError("Missing stage mapping during migration")
                self._migrate_interaction_runtime(
                    interaction, target_version, target_stage
                )
                job.migrated_interaction_count += 1

            job.status = "COMPLETED"
            job.completed_at = datetime.now(timezone.utc)
            self.audit_repository.add(
                AuditEvent(
                    actor_user_id=created_by,
                    action="workflow.migration.executed",
                    entity_type="workflow_migration_job",
                    entity_id=job.id,
                    event_metadata={
                        "source_version_id": str(source_version.id),
                        "target_version_id": str(target_version.id),
                        "affected_interaction_count": job.affected_interaction_count,
                        "migrated_interaction_count": job.migrated_interaction_count,
                    },
                    request_id=request_id,
                )
            )
            self.db.commit()
        except Exception as exc:
            job.status = "FAILED"
            job.error_message = str(exc)
            self.db.rollback()
            raise
        self.db.refresh(job)
        return job

    def detect_dangerous_changes(
        self, version_id: UUID
    ) -> WorkflowDangerousChangesRead:
        version = self.db.get(WorkflowVersion, version_id)
        if version is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow version not found",
            )
        if version.supersedes_version_id is None:
            return WorkflowDangerousChangesRead(
                workflow_version_id=version.id,
                supersedes_version_id=None,
                has_dangerous_changes=False,
                changes=[],
            )
        source = self.db.get(WorkflowVersion, version.supersedes_version_id)
        if source is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Superseded workflow version not found",
            )
        active_interaction_count = self._count_active_interactions(source.id)
        changes = self._build_dangerous_changes(
            draft_stages=self.stage_repository.list_active_by_version(version.id),
            source_stages=self.stage_repository.list_active_by_version(source.id),
            draft_transitions=self.transition_repository.list_by_version(version.id),
            source_transitions=self.transition_repository.list_by_version(source.id),
            active_interaction_count=active_interaction_count,
        )
        return WorkflowDangerousChangesRead(
            workflow_version_id=version.id,
            supersedes_version_id=source.id,
            active_interaction_count=active_interaction_count,
            has_dangerous_changes=any(
                change.severity in {"MEDIUM", "HIGH"} for change in changes
            ),
            changes=changes,
        )

    def _count_active_interactions(self, workflow_version_id: UUID) -> int:
        statement = (
            select(func.count())
            .select_from(UniversityInteraction)
            .where(
                UniversityInteraction.workflow_version_id == workflow_version_id,
                UniversityInteraction.status.not_in(TERMINAL_INTERACTION_STATUSES),
            )
        )
        return self.db.scalar(statement) or 0

    def _build_dangerous_changes(
        self,
        *,
        draft_stages: list[WorkflowStage],
        source_stages: list[WorkflowStage],
        draft_transitions: list[WorkflowTransition],
        source_transitions: list[WorkflowTransition],
        active_interaction_count: int,
    ) -> list[WorkflowDangerousChangeRead]:
        draft_stages_by_name = {stage.name: stage for stage in draft_stages}
        source_stages_by_name = {stage.name: stage for stage in source_stages}
        changes: list[WorkflowDangerousChangeRead] = []
        active_details = {"activeInteractionCount": active_interaction_count}

        for stage_name, source_stage in source_stages_by_name.items():
            draft_stage = draft_stages_by_name.get(stage_name)
            if draft_stage is None:
                changes.append(
                    WorkflowDangerousChangeRead(
                        change_type="STAGE_REMOVED",
                        severity="HIGH",
                        stage_name=stage_name,
                        message="Stage from superseded version is missing in draft.",
                        details=active_details,
                    )
                )
                continue
            stage_flag_changes = self._stage_flag_changes(source_stage, draft_stage)
            if stage_flag_changes:
                changes.append(
                    WorkflowDangerousChangeRead(
                        change_type="STAGE_CONTRACT_CHANGED",
                        severity="MEDIUM",
                        stage_name=stage_name,
                        message="Stage runtime contract changed.",
                        details={**active_details, "fields": stage_flag_changes},
                    )
                )
            if source_stage.order_index != draft_stage.order_index:
                changes.append(
                    WorkflowDangerousChangeRead(
                        change_type="STAGE_ORDER_CHANGED",
                        severity="LOW",
                        stage_name=stage_name,
                        message="Stage order changed.",
                        details={
                            **active_details,
                            "fromOrderIndex": source_stage.order_index,
                            "toOrderIndex": draft_stage.order_index,
                        },
                    )
                )

        for stage_name in draft_stages_by_name.keys() - source_stages_by_name.keys():
            changes.append(
                WorkflowDangerousChangeRead(
                    change_type="STAGE_ADDED",
                    severity="LOW",
                    stage_name=stage_name,
                    message="New stage added in draft.",
                    details=active_details,
                )
            )

        draft_transition_keys = self._transition_keys(draft_transitions, draft_stages)
        source_transition_keys = self._transition_keys(
            source_transitions, source_stages
        )
        for from_stage_name, to_stage_name in (
            source_transition_keys - draft_transition_keys
        ):
            changes.append(
                WorkflowDangerousChangeRead(
                    change_type="TRANSITION_REMOVED",
                    severity="HIGH",
                    from_stage_name=from_stage_name,
                    to_stage_name=to_stage_name,
                    message="Transition from superseded version is missing in draft.",
                    details=active_details,
                )
            )
        for from_stage_name, to_stage_name in (
            draft_transition_keys - source_transition_keys
        ):
            changes.append(
                WorkflowDangerousChangeRead(
                    change_type="TRANSITION_ADDED",
                    severity="LOW",
                    from_stage_name=from_stage_name,
                    to_stage_name=to_stage_name,
                    message="New transition added in draft.",
                    details=active_details,
                )
            )

        return changes

    def _stage_flag_changes(
        self, source_stage: WorkflowStage, draft_stage: WorkflowStage
    ) -> list[str]:
        tracked_fields = (
            "is_initial",
            "is_final",
            "is_optional",
            "requires_comment",
            "requires_attachment",
        )
        return [
            field
            for field in tracked_fields
            if getattr(source_stage, field) != getattr(draft_stage, field)
        ]

    def _transition_keys(
        self,
        transitions: list[WorkflowTransition],
        stages: list[WorkflowStage],
    ) -> set[tuple[str, str]]:
        stage_names = {stage.id: stage.name for stage in stages}
        return {
            (stage_names[transition.from_stage_id], stage_names[transition.to_stage_id])
            for transition in transitions
            if transition.from_stage_id in stage_names
            and transition.to_stage_id in stage_names
        }

    def _get_migration_versions(
        self, target_version_id: UUID
    ) -> tuple[WorkflowVersion, WorkflowVersion]:
        target_version = self.db.get(WorkflowVersion, target_version_id)
        if target_version is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow version not found",
            )
        if target_version.supersedes_version_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow version has no source version",
            )
        source_version = self.db.get(
            WorkflowVersion, target_version.supersedes_version_id
        )
        if source_version is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source workflow version not found",
            )
        return target_version, source_version

    def _list_active_interactions_by_version(
        self,
        workflow_version_id: UUID,
        *,
        lock: bool = False,
    ) -> list[UniversityInteraction]:
        statement = select(UniversityInteraction).where(
            UniversityInteraction.workflow_version_id == workflow_version_id,
            UniversityInteraction.status.not_in(TERMINAL_INTERACTION_STATUSES),
        )
        if lock:
            statement = statement.with_for_update()
        return list(self.db.scalars(statement).all())

    def _resolve_stage_mappings(
        self,
        source_version_id: UUID,
        target_version_id: UUID,
        requested_mappings: list,
        *,
        persist: bool,
    ) -> dict[UUID, WorkflowStage]:
        source_stages = self.stage_repository.list_active_by_version(source_version_id)
        target_stages = self.stage_repository.list_active_by_version(target_version_id)
        target_by_id = {stage.id: stage for stage in target_stages}
        target_by_name = {stage.name: stage for stage in target_stages}
        mappings: dict[UUID, WorkflowStage] = {}

        for source_stage in source_stages:
            target_stage = target_by_name.get(source_stage.name)
            if target_stage is not None:
                mappings[source_stage.id] = target_stage

        for persisted in self.stage_mapping_repository.list_by_versions(
            source_version_id, target_version_id
        ):
            target_stage = target_by_id.get(persisted.target_stage_id)
            if target_stage is not None:
                mappings[persisted.source_stage_id] = target_stage

        for requested in requested_mappings:
            target_stage = target_by_id.get(requested.target_stage_id)
            if target_stage is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Target stage not found",
                )
            mappings[requested.source_stage_id] = target_stage
            if not persist:
                continue
            existing = next(
                (
                    mapping
                    for mapping in self.stage_mapping_repository.list_by_versions(
                        source_version_id, target_version_id
                    )
                    if mapping.source_stage_id == requested.source_stage_id
                ),
                None,
            )
            if existing is None:
                self.stage_mapping_repository.add(
                    WorkflowStageMapping(
                        source_version_id=source_version_id,
                        target_version_id=target_version_id,
                        source_stage_id=requested.source_stage_id,
                        target_stage_id=requested.target_stage_id,
                    )
                )
            else:
                existing.target_stage_id = requested.target_stage_id

        return mappings

    def _stage_mapping_reads(
        self, mappings: dict[UUID, WorkflowStage]
    ) -> list[WorkflowStageMappingRead]:
        result: list[WorkflowStageMappingRead] = []
        for source_stage_id, target_stage in mappings.items():
            source_stage = self.db.get(WorkflowStage, source_stage_id)
            if source_stage is None:
                continue
            result.append(
                WorkflowStageMappingRead(
                    source_stage_id=source_stage.id,
                    source_stage_name=source_stage.name,
                    target_stage_id=target_stage.id,
                    target_stage_name=target_stage.name,
                )
            )
        return result

    def _get_current_stage_id(self, interaction: UniversityInteraction) -> UUID | None:
        if interaction.current_stage_instance_id is None:
            return None
        current_instance = self.db.get(
            WorkflowStageInstance, interaction.current_stage_instance_id
        )
        if current_instance is None:
            return None
        return current_instance.workflow_stage_id

    def _migrate_interaction_runtime(
        self,
        interaction: UniversityInteraction,
        target_version: WorkflowVersion,
        target_current_stage: WorkflowStage,
    ) -> None:
        now = datetime.now(timezone.utc)
        target_stages = self.stage_repository.list_active_by_version(target_version.id)
        instances_by_stage_id: dict[UUID, WorkflowStageInstance] = {}
        for stage in target_stages:
            instance = self.db.scalar(
                select(WorkflowStageInstance).where(
                    WorkflowStageInstance.interaction_id == interaction.id,
                    WorkflowStageInstance.workflow_stage_id == stage.id,
                )
            )
            if instance is None:
                instance = WorkflowStageInstance(
                    interaction_id=interaction.id,
                    workflow_stage_id=stage.id,
                    responsible_user_id=interaction.manager_user_id,
                    status="NOT_STARTED",
                )
                self.instance_repository.add(instance)
            instances_by_stage_id[stage.id] = instance

        current_instance = instances_by_stage_id[target_current_stage.id]
        current_instance.status = "IN_PROGRESS"
        current_instance.started_at = current_instance.started_at or now
        current_instance.due_at = current_instance.due_at or WorkflowRuntimeService(
            self.db
        )._calculate_due_at(
            now,
            target_current_stage,
        )
        interaction.workflow_version_id = target_version.id
        interaction.workflow_template_id = target_version.workflow_template_id
        interaction.current_stage_instance_id = current_instance.id

    def _get_template(self, template_id: UUID) -> WorkflowTemplate:
        template = self.template_repository.get(template_id)
        if template is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow template not found",
            )
        return template

    def _get_next_version_number(self, template_id: UUID) -> int:
        current_max = self.db.scalar(
            select(func.max(WorkflowVersion.version)).where(
                WorkflowVersion.workflow_template_id == template_id
            )
        )
        return (current_max or 0) + 1

    def _clone_version_structure(
        self, source: WorkflowVersion, draft: WorkflowVersion
    ) -> None:
        stage_map: dict[UUID, WorkflowStage] = {}
        for stage in self.stage_repository.list_active_by_version(source.id):
            cloned_stage = WorkflowStage(
                workflow_template_id=draft.workflow_template_id,
                workflow_version_id=draft.id,
                name=stage.name,
                description=stage.description,
                order_index=stage.order_index,
                is_initial=stage.is_initial,
                is_final=stage.is_final,
                is_optional=stage.is_optional,
                default_duration_days=stage.default_duration_days,
                requires_comment=stage.requires_comment,
                requires_attachment=stage.requires_attachment,
                is_active=stage.is_active,
            )
            self.stage_repository.add(cloned_stage)
            stage_map[stage.id] = cloned_stage

        source_transitions = self.db.scalars(
            select(WorkflowTransition).where(
                WorkflowTransition.workflow_version_id == source.id
            )
        ).all()
        for transition in source_transitions:
            from_stage = stage_map.get(transition.from_stage_id)
            to_stage = stage_map.get(transition.to_stage_id)
            if from_stage is None or to_stage is None:
                continue
            self.transition_repository.add(
                WorkflowTransition(
                    workflow_template_id=draft.workflow_template_id,
                    workflow_version_id=draft.id,
                    from_stage_id=from_stage.id,
                    to_stage_id=to_stage.id,
                    name=transition.name,
                    is_default=transition.is_default,
                    condition_code=transition.condition_code,
                )
            )

    def _validate_publish_graph(
        self,
        version: WorkflowVersion,
        stages: list[WorkflowStage],
        transitions: list[WorkflowTransition],
    ) -> None:
        active_stage_ids = {stage.id for stage in stages}
        initial_stages = [stage for stage in stages if stage.is_initial]
        final_stages = [stage for stage in stages if stage.is_final]
        if len(initial_stages) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow version must have exactly one initial stage",
            )
        if not final_stages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow version must have at least one final stage",
            )

        outgoing_stage_ids: set[UUID] = set()
        incoming_stage_ids: set[UUID] = set()
        default_from_stage_ids: set[UUID] = set()
        transition_pairs: set[tuple[UUID, UUID]] = set()

        for transition in transitions:
            if transition.workflow_version_id != version.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Workflow transition belongs to another version",
                )
            if (
                transition.from_stage_id not in active_stage_ids
                or transition.to_stage_id not in active_stage_ids
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Workflow transition references inactive or missing stage",
                )
            if transition.from_stage_id == transition.to_stage_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Workflow transition cannot point to the same stage",
                )
            transition_pair = (transition.from_stage_id, transition.to_stage_id)
            if transition_pair in transition_pairs:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Workflow version contains duplicate transition",
                )
            transition_pairs.add(transition_pair)
            if transition.is_default:
                if transition.from_stage_id in default_from_stage_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Workflow stage cannot have more than one default transition",
                    )
                default_from_stage_ids.add(transition.from_stage_id)
            outgoing_stage_ids.add(transition.from_stage_id)
            incoming_stage_ids.add(transition.to_stage_id)

        for stage in stages:
            if not stage.is_final and stage.id not in outgoing_stage_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Every non-final workflow stage must have at least one outgoing transition",
                )
            if not stage.is_initial and stage.id not in incoming_stage_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Every non-initial workflow stage must have at least one incoming transition",
                )


class WorkflowStageService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = WorkflowStageRepository(db)

    def list_stages(
        self,
        *,
        workflow_template_id: UUID | None,
        workflow_version_id: UUID | None,
        is_active: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[WorkflowStage]:
        return self.repository.list(
            filters={
                "workflow_template_id": workflow_template_id,
                "workflow_version_id": workflow_version_id,
                "is_active": is_active,
            },
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_stage(self, stage_id: UUID) -> WorkflowStage:
        stage = self.repository.get(stage_id)
        if stage is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Workflow stage not found"
            )
        return stage

    def create_stage(self, payload: WorkflowStageCreate) -> WorkflowStage:
        workflow_version_id = self._resolve_draft_version(
            payload.workflow_template_id, payload.workflow_version_id
        )
        stage = WorkflowStage(
            **payload.model_dump(exclude={"workflow_version_id"}),
            workflow_version_id=workflow_version_id,
        )
        self.repository.add(stage)
        self.db.commit()
        self.db.refresh(stage)
        return stage

    def update_stage(
        self, stage_id: UUID, payload: WorkflowStageUpdate
    ) -> WorkflowStage:
        stage = self.get_stage(stage_id)
        self._ensure_version_is_draft(stage.workflow_version_id)
        if payload.workflow_template_id is not None:
            self._validate_template(payload.workflow_template_id)
        if payload.workflow_version_id is not None:
            self._validate_version(
                payload.workflow_template_id or stage.workflow_template_id,
                payload.workflow_version_id,
            )
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(stage, field, value)
        self.db.commit()
        self.db.refresh(stage)
        return stage

    def _validate_template(self, template_id: UUID) -> None:
        if self.db.get(WorkflowTemplate, template_id) is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow template not found",
            )

    def _resolve_draft_version(
        self, template_id: UUID, version_id: UUID | None
    ) -> UUID:
        self._validate_template(template_id)
        if version_id is not None:
            self._validate_version(template_id, version_id)
            self._ensure_version_is_draft(version_id)
            return version_id

        draft = self.db.scalar(
            select(WorkflowVersion).where(
                WorkflowVersion.workflow_template_id == template_id,
                WorkflowVersion.status == "DRAFT",
            )
        )
        if draft is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Create draft before editing workflow stages",
            )
        return draft.id

    def _validate_version(self, template_id: UUID, version_id: UUID) -> WorkflowVersion:
        version = self.db.get(WorkflowVersion, version_id)
        if version is None or version.workflow_template_id != template_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow version not found",
            )
        return version

    def _ensure_version_is_draft(self, version_id: UUID) -> None:
        version = self.db.get(WorkflowVersion, version_id)
        if version is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow version not found",
            )
        if version.status != "DRAFT":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Published workflow version is immutable",
            )


class WorkflowTransitionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = WorkflowTransitionRepository(db)

    def list_transitions(
        self,
        *,
        workflow_template_id: UUID | None,
        workflow_version_id: UUID | None,
        from_stage_id: UUID | None,
        to_stage_id: UUID | None,
        is_default: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[WorkflowTransition]:
        return self.repository.list(
            filters={
                "workflow_template_id": workflow_template_id,
                "workflow_version_id": workflow_version_id,
                "from_stage_id": from_stage_id,
                "to_stage_id": to_stage_id,
                "is_default": is_default,
            },
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_transition(self, transition_id: UUID) -> WorkflowTransition:
        transition = self.repository.get(transition_id)
        if transition is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow transition not found",
            )
        return transition

    def create_transition(
        self, payload: WorkflowTransitionCreate
    ) -> WorkflowTransition:
        workflow_version_id = self._resolve_draft_version(
            payload.workflow_template_id, payload.workflow_version_id
        )
        payload = payload.model_copy(
            update={"workflow_version_id": workflow_version_id}
        )
        self._validate_transition_payload(payload)
        transition = WorkflowTransition(**payload.model_dump())
        self.repository.add(transition)
        self.db.commit()
        self.db.refresh(transition)
        return transition

    def update_transition(
        self,
        transition_id: UUID,
        payload: WorkflowTransitionUpdate,
    ) -> WorkflowTransition:
        transition = self.get_transition(transition_id)
        self._ensure_version_is_draft(transition.workflow_version_id)
        merged = WorkflowTransitionCreate(
            workflow_template_id=payload.workflow_template_id
            or transition.workflow_template_id,
            workflow_version_id=payload.workflow_version_id
            or transition.workflow_version_id,
            from_stage_id=payload.from_stage_id or transition.from_stage_id,
            to_stage_id=payload.to_stage_id or transition.to_stage_id,
            name=payload.name if payload.name is not None else transition.name,
            is_default=payload.is_default
            if payload.is_default is not None
            else transition.is_default,
            condition_code=payload.condition_code
            if payload.condition_code is not None
            else transition.condition_code,
        )
        self._validate_transition_payload(merged)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(transition, field, value)
        self.db.commit()
        self.db.refresh(transition)
        return transition

    def _validate_transition_payload(self, payload: WorkflowTransitionCreate) -> None:
        template = self.db.get(WorkflowTemplate, payload.workflow_template_id)
        from_stage = self.db.get(WorkflowStage, payload.from_stage_id)
        to_stage = self.db.get(WorkflowStage, payload.to_stage_id)
        if template is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow template not found",
            )
        if from_stage is None or to_stage is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow stage not found",
            )
        if from_stage.workflow_template_id != payload.workflow_template_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="From stage belongs to another template",
            )
        if to_stage.workflow_template_id != payload.workflow_template_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="To stage belongs to another template",
            )
        if payload.workflow_version_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow version is required",
            )
        version = self.db.get(WorkflowVersion, payload.workflow_version_id)
        if (
            version is None
            or version.workflow_template_id != payload.workflow_template_id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow version not found",
            )
        if version.status != "DRAFT":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Published workflow version is immutable",
            )
        if from_stage.workflow_version_id != payload.workflow_version_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="From stage belongs to another version",
            )
        if to_stage.workflow_version_id != payload.workflow_version_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="To stage belongs to another version",
            )

    def _resolve_draft_version(
        self, template_id: UUID, version_id: UUID | None
    ) -> UUID:
        if self.db.get(WorkflowTemplate, template_id) is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow template not found",
            )
        if version_id is not None:
            self._ensure_version_is_draft(version_id, template_id)
            return version_id
        draft = self.db.scalar(
            select(WorkflowVersion).where(
                WorkflowVersion.workflow_template_id == template_id,
                WorkflowVersion.status == "DRAFT",
            )
        )
        if draft is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Create draft before editing workflow transitions",
            )
        return draft.id

    def _ensure_version_is_draft(
        self, version_id: UUID, template_id: UUID | None = None
    ) -> None:
        version = self.db.get(WorkflowVersion, version_id)
        if version is None or (
            template_id is not None and version.workflow_template_id != template_id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow version not found",
            )
        if version.status != "DRAFT":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Published workflow version is immutable",
            )


class WorkflowRuntimeService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.stage_repository = WorkflowStageRepository(db)
        self.instance_repository = WorkflowStageInstanceRepository(db)
        self.transition_repository = WorkflowTransitionRepository(db)
        self.history_repository = WorkflowTransitionHistoryRepository(db)

    def validate_template_has_stages(self, template_id: UUID) -> None:
        version = WorkflowVersionService(self.db).get_current_published_version(
            template_id
        )
        stages = self.stage_repository.list_active_by_version(version.id)
        if not stages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow template has no active stages",
            )

    def initialize_interaction_workflow(
        self, interaction: UniversityInteraction
    ) -> None:
        if interaction.workflow_template_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow template is required",
            )
        if interaction.workflow_version_id is None:
            interaction.workflow_version_id = (
                WorkflowVersionService(self.db)
                .get_current_published_version(interaction.workflow_template_id)
                .id
            )

        stages = self.stage_repository.list_active_by_version(
            interaction.workflow_version_id
        )
        if not stages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow template has no active stages",
            )

        now = datetime.now(timezone.utc)
        initial_stage = next((stage for stage in stages if stage.is_initial), stages[0])
        instances: dict[UUID, WorkflowStageInstance] = {}

        for stage in stages:
            is_initial = stage.id == initial_stage.id
            instance = WorkflowStageInstance(
                interaction_id=interaction.id,
                workflow_stage_id=stage.id,
                responsible_user_id=interaction.manager_user_id,
                status="IN_PROGRESS" if is_initial else "NOT_STARTED",
                started_at=now if is_initial else None,
                due_at=self._calculate_due_at(now, stage) if is_initial else None,
            )
            self.instance_repository.add(instance)
            instances[stage.id] = instance
            for checklist_item in self.db.scalars(
                select(PlaybookChecklistItem).where(
                    PlaybookChecklistItem.workflow_stage_id == stage.id
                )
            ):
                self.db.add(
                    ProgramChecklistValue(
                        checklist_item_id=checklist_item.id,
                        stage_instance_id=instance.id,
                    )
                )

        interaction.current_stage_instance_id = instances[initial_stage.id].id

    def initialize_program_workflow(self, program: ProgramInstance) -> None:
        program.workflow_version_id = (
            WorkflowVersionService(self.db)
            .get_current_published_version(program.playbook_template_id)
            .id
        )
        stages = self.stage_repository.list_active_by_version(
            program.workflow_version_id
        )
        if not stages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow template has no active stages",
            )
        now = datetime.now(timezone.utc)
        initial = next((stage for stage in stages if stage.is_initial), stages[0])
        for stage in stages:
            instance = WorkflowStageInstance(
                program_instance_id=program.id,
                workflow_stage_id=stage.id,
                responsible_user_id=program.kam_user_id,
                status="IN_PROGRESS" if stage.id == initial.id else "NOT_STARTED",
                started_at=now if stage.id == initial.id else None,
                due_at=self._calculate_due_at(now, stage)
                if stage.id == initial.id
                else None,
            )
            self.db.add(instance)
            self.db.flush()
            if stage.id == initial.id:
                program.current_stage_instance_id = instance.id
            for item in self.db.scalars(
                select(PlaybookChecklistItem).where(
                    PlaybookChecklistItem.workflow_stage_id == stage.id
                )
            ):
                self.db.add(
                    ProgramChecklistValue(
                        checklist_item_id=item.id, stage_instance_id=instance.id
                    )
                )

    def list_available_program_transitions(
        self, program: ProgramInstance
    ) -> list[WorkflowAvailableTransitionRead]:
        if (
            program.workflow_version_id is None
            or program.current_stage_instance_id is None
        ):
            return []
        current = self.db.get(WorkflowStageInstance, program.current_stage_instance_id)
        if current is None or current.status not in {
            "IN_PROGRESS",
            "WAITING",
            "BLOCKED",
        }:
            return []
        stage = self.db.get(WorkflowStage, current.workflow_stage_id)
        if stage is None:
            return []
        transitions = self.transition_repository.list_from_stage(
            version_id=program.workflow_version_id, from_stage_id=stage.id
        )
        return [
            WorkflowAvailableTransitionRead(
                **WorkflowTransitionRead.model_validate(item).model_dump(),
                transition_kind=self._classify_transition(
                    stage, target, len(transitions) > 1
                ),
                to_stage=WorkflowStageRead.model_validate(target),
            )
            for item in transitions
            if (target := self.db.get(WorkflowStage, item.to_stage_id)) is not None
            and target.is_active
        ]

    def list_stage_instances(
        self,
        *,
        interaction_id: UUID | None,
        status_value: str | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[WorkflowStageInstance]:
        return self.instance_repository.list(
            filters={"interaction_id": interaction_id, "status": status_value},
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_current_stage_instance(self, interaction_id: UUID) -> WorkflowStageInstance:
        interaction = self.db.get(UniversityInteraction, interaction_id)
        if interaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="University interaction not found",
            )
        if interaction.current_stage_instance_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Interaction has no current stage",
            )
        instance = self.db.get(
            WorkflowStageInstance, interaction.current_stage_instance_id
        )
        if instance is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current stage instance not found",
            )
        return instance

    def update_stage_instance_status(
        self,
        stage_instance_id: UUID,
        payload: WorkflowStageInstanceStatusUpdate,
    ) -> WorkflowStageInstance:
        instance = self.instance_repository.get(stage_instance_id)
        if instance is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow stage instance not found",
            )
        instance.status = payload.status
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def list_transition_history(
        self,
        *,
        interaction_id: UUID | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[WorkflowTransitionHistory]:
        return self.history_repository.list(
            filters={"interaction_id": interaction_id},
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def list_available_transitions(
        self, interaction_id: UUID
    ) -> list[WorkflowAvailableTransitionRead]:
        interaction = self.db.get(UniversityInteraction, interaction_id)
        if interaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="University interaction not found",
            )
        if (
            interaction.workflow_template_id is None
            or interaction.workflow_version_id is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Interaction workflow is not initialized",
            )

        current_instance = self.get_current_stage_instance(interaction_id)
        current_stage = self.db.get(WorkflowStage, current_instance.workflow_stage_id)
        if current_stage is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current workflow stage not found",
            )
        if current_instance.status not in {"IN_PROGRESS", "WAITING", "BLOCKED"}:
            return []

        transitions = self.transition_repository.list_from_stage(
            version_id=interaction.workflow_version_id,
            from_stage_id=current_stage.id,
        )
        is_branch = len(transitions) > 1
        result: list[WorkflowAvailableTransitionRead] = []
        for transition in transitions:
            target_stage = self.db.get(WorkflowStage, transition.to_stage_id)
            if target_stage is None or not target_stage.is_active:
                continue
            result.append(
                WorkflowAvailableTransitionRead(
                    **WorkflowTransitionRead.model_validate(transition).model_dump(),
                    transition_kind=self._classify_transition(
                        current_stage, target_stage, is_branch
                    ),
                    to_stage=WorkflowStageRead.model_validate(target_stage),
                )
            )
        return result

    def execute_transition(
        self,
        interaction_id: UUID,
        payload: WorkflowTransitionExecute,
        *,
        request_id: str | None = None,
    ) -> WorkflowTransitionResult:
        return TransitionService(self.db).execute_transition(
            interaction_id, payload, request_id=request_id
        )

    def _calculate_due_at(
        self, started_at: datetime, stage: WorkflowStage
    ) -> datetime | None:
        if stage.default_duration_days is None:
            return None
        return started_at + timedelta(days=stage.default_duration_days)

    def _classify_transition(
        self,
        current_stage: WorkflowStage,
        target_stage: WorkflowStage,
        is_branch: bool,
    ) -> str:
        if target_stage.order_index < current_stage.order_index:
            return "BACKWARD"
        if is_branch:
            return "BRANCH"
        if target_stage.is_optional:
            return "OPTIONAL"
        return "FORWARD"


class TransitionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.transition_repository = WorkflowTransitionRepository(db)
        self.history_repository = WorkflowTransitionHistoryRepository(db)
        self.audit_repository = AuditEventRepository(db)

    def execute_transition(
        self,
        interaction_id: UUID,
        payload: WorkflowTransitionExecute,
        *,
        request_id: str | None = None,
    ) -> WorkflowTransitionResult:
        interaction = self.db.get(
            UniversityInteraction, interaction_id, with_for_update=True
        )
        if interaction is None:
            raise workflow_error(
                status_code=status.HTTP_404_NOT_FOUND,
                code="WORKFLOW_INTERACTION_NOT_FOUND",
                message="University interaction not found",
            )
        if interaction.status in TERMINAL_INTERACTION_STATUSES:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_INTERACTION_TERMINAL",
                message="Interaction is already terminal",
                details={"interactionStatus": interaction.status},
            )
        if (
            interaction.workflow_template_id is None
            or interaction.current_stage_instance_id is None
        ):
            raise workflow_error(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="WORKFLOW_NOT_INITIALIZED",
                message="Interaction workflow is not initialized",
            )
        if interaction.workflow_version_id is None:
            raise workflow_error(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="WORKFLOW_VERSION_NOT_INITIALIZED",
                message="Interaction workflow version is not initialized",
            )

        current_instance = self.db.get(
            WorkflowStageInstance,
            interaction.current_stage_instance_id,
            with_for_update=True,
        )
        if current_instance is None:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_CURRENT_STAGE_NOT_FOUND",
                message="Current stage instance not found",
            )
        if (
            payload.expected_current_stage_instance_id is not None
            and payload.expected_current_stage_instance_id != current_instance.id
        ):
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_CURRENT_STAGE_CHANGED",
                message="Current stage changed",
                details={
                    "expectedCurrentStageInstanceId": str(
                        payload.expected_current_stage_instance_id
                    ),
                    "actualCurrentStageInstanceId": str(current_instance.id),
                },
            )
        current_stage = self.db.get(WorkflowStage, current_instance.workflow_stage_id)
        if current_stage is None:
            raise workflow_error(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="WORKFLOW_CURRENT_STAGE_NOT_FOUND",
                message="Current workflow stage not found",
            )
        if current_instance.status not in {"IN_PROGRESS", "WAITING", "BLOCKED"}:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_CURRENT_STAGE_NOT_ACTIVE",
                message="Current stage is not active",
                details={"currentStageStatus": current_instance.status},
            )

        transition = self.transition_repository.get_allowed_transition(
            transition_id=payload.transition_id,
            template_id=interaction.workflow_template_id,
            version_id=interaction.workflow_version_id,
            from_stage_id=current_stage.id,
        )
        if transition is None:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_TRANSITION_NOT_ALLOWED",
                message="Transition is not allowed",
                details={
                    "transitionId": str(payload.transition_id),
                    "currentStageId": str(current_stage.id),
                    "workflowVersionId": str(interaction.workflow_version_id),
                },
            )

        if payload.skip_current and not current_stage.is_optional:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_STAGE_NOT_OPTIONAL",
                message="Only optional stages can be skipped",
                details={"currentStageId": str(current_stage.id)},
            )

        self._validate_stage_requirements(current_stage, current_instance, payload)

        next_instance = self._get_stage_instance(interaction.id, transition.to_stage_id)
        now = datetime.now(timezone.utc)
        next_stage = self.db.get(WorkflowStage, transition.to_stage_id)
        if next_stage is None:
            raise workflow_error(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="WORKFLOW_TARGET_STAGE_NOT_FOUND",
                message="Target workflow stage not found",
                details={"targetStageId": str(transition.to_stage_id)},
            )

        try:
            current_instance.status = "SKIPPED" if payload.skip_current else "COMPLETED"
            current_instance.completed_at = None if payload.skip_current else now
            current_instance.skipped_at = now if payload.skip_current else None

            next_instance.status = "IN_PROGRESS"
            next_instance.started_at = next_instance.started_at or now
            next_instance.due_at = next_instance.due_at or self._calculate_due_at(
                now, next_stage
            )

            history = WorkflowTransitionHistory(
                interaction_id=interaction.id,
                from_stage_instance_id=current_instance.id,
                to_stage_instance_id=next_instance.id,
                transition_id=transition.id,
                performed_by=self._get_performed_by(payload),
                comment=payload.comment,
                performed_at=now,
            )
            self.history_repository.add(history)
            interaction.current_stage_instance_id = next_instance.id
            self.audit_repository.add(
                AuditEvent(
                    actor_user_id=self._get_performed_by(payload),
                    action="workflow.transition",
                    entity_type="interaction",
                    entity_id=interaction.id,
                    reason=payload.comment,
                    event_metadata={
                        "transition_id": str(payload.transition_id),
                        "from_stage_instance_id": str(current_instance.id),
                        "to_stage_instance_id": str(next_instance.id),
                        "transition_history_id": str(history.id),
                        "skip_current": payload.skip_current,
                    },
                    request_id=request_id,
                )
            )

            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        self.db.refresh(history)
        self.db.refresh(interaction)
        return WorkflowTransitionResult(
            interaction_id=interaction.id,
            from_stage_instance_id=current_instance.id,
            to_stage_instance_id=next_instance.id,
            transition_history_id=history.id,
            current_stage_instance_id=interaction.current_stage_instance_id,
        )

    def execute_program_transition(
        self,
        program: ProgramInstance,
        payload: WorkflowTransitionExecute,
        *,
        request_id: str | None = None,
    ) -> dict:
        if (
            program.status in {"completed", "cancelled"}
            or program.workflow_version_id is None
            or program.current_stage_instance_id is None
        ):
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_NOT_INITIALIZED",
                message="Program workflow is not active",
            )
        current = self.db.get(
            WorkflowStageInstance,
            program.current_stage_instance_id,
            with_for_update=True,
        )
        if current is None:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_CURRENT_STAGE_NOT_FOUND",
                message="Current stage instance not found",
            )
        if (
            payload.expected_current_stage_instance_id
            and payload.expected_current_stage_instance_id != current.id
        ):
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_CURRENT_STAGE_CHANGED",
                message="Current stage changed",
            )
        stage = self.db.get(WorkflowStage, current.workflow_stage_id)
        if stage is None or current.status not in {"IN_PROGRESS", "WAITING", "BLOCKED"}:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_CURRENT_STAGE_NOT_ACTIVE",
                message="Current stage is not active",
            )
        if payload.skip_current and not stage.is_optional:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_STAGE_NOT_OPTIONAL",
                message="Only optional stages can be skipped",
                details={"currentStageId": str(stage.id)},
            )

        if stage.is_final:
            self._validate_stage_requirements(stage, current, payload)
            now = datetime.now(timezone.utc)
            current.status = "SKIPPED" if payload.skip_current else "COMPLETED"
            current.completed_at = None if payload.skip_current else now
            current.skipped_at = now if payload.skip_current else None
            history = WorkflowTransitionHistory(
                program_instance_id=program.id,
                from_stage_instance_id=current.id,
                to_stage_instance_id=None,
                transition_id=None,
                performed_by=self._get_performed_by(payload),
                comment=payload.comment,
                performed_at=now,
            )
            self.history_repository.add(history)
            program.status = "completed"
            program.completed_at = now
            program.current_stage_instance_id = None
            program.current_stage_code = None
            self.audit_repository.add(
                AuditEvent(
                    actor_user_id=self._get_performed_by(payload),
                    action="workflow.program_completed",
                    entity_type="program_instance",
                    entity_id=program.id,
                    reason=payload.comment,
                    event_metadata={"final_stage_instance_id": str(current.id)},
                    request_id=request_id,
                )
            )
            self.db.flush()
            return {
                "program_instance_id": str(program.id),
                "current_stage_instance_id": None,
                "transition_history_id": str(history.id),
                "status": program.status,
            }

        if payload.transition_id is None:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_TRANSITION_REQUIRED",
                message="Transition is required for a non-final stage",
            )
        transition = self.transition_repository.get_allowed_transition(
            transition_id=payload.transition_id,
            template_id=program.playbook_template_id,
            version_id=program.workflow_version_id,
            from_stage_id=stage.id,
        )
        if transition is None:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_TRANSITION_NOT_ALLOWED",
                message="Transition is not allowed",
            )
        self._validate_stage_requirements(stage, current, payload)
        next_instance = self.db.scalar(
            select(WorkflowStageInstance)
            .where(
                WorkflowStageInstance.program_instance_id == program.id,
                WorkflowStageInstance.workflow_stage_id == transition.to_stage_id,
            )
            .with_for_update()
        )
        next_stage = self.db.get(WorkflowStage, transition.to_stage_id)
        if next_instance is None or next_stage is None:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_TARGET_STAGE_INSTANCE_NOT_FOUND",
                message="Target stage instance not found",
            )
        now = datetime.now(timezone.utc)
        current.status = "SKIPPED" if payload.skip_current else "COMPLETED"
        current.completed_at = None if payload.skip_current else now
        current.skipped_at = now if payload.skip_current else None
        next_instance.status = "IN_PROGRESS"
        next_instance.started_at = next_instance.started_at or now
        next_instance.due_at = next_instance.due_at or self._calculate_due_at(
            now, next_stage
        )
        history = WorkflowTransitionHistory(
            program_instance_id=program.id,
            from_stage_instance_id=current.id,
            to_stage_instance_id=next_instance.id,
            transition_id=transition.id,
            performed_by=self._get_performed_by(payload),
            comment=payload.comment,
            performed_at=now,
        )
        self.history_repository.add(history)
        program.current_stage_instance_id = next_instance.id
        self.audit_repository.add(
            AuditEvent(
                actor_user_id=self._get_performed_by(payload),
                action="workflow.transition",
                entity_type="program_instance",
                entity_id=program.id,
                reason=payload.comment,
                event_metadata={"transition_id": str(transition.id)},
                request_id=request_id,
            )
        )
        self.db.flush()
        return {
            "program_instance_id": str(program.id),
            "current_stage_instance_id": str(next_instance.id),
            "transition_history_id": str(history.id),
        }

    def _validate_stage_requirements(
        self,
        stage: WorkflowStage,
        instance: WorkflowStageInstance,
        payload: WorkflowTransitionExecute,
    ) -> None:
        if stage.requires_comment and not (payload.comment and payload.comment.strip()):
            raise workflow_error(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="WORKFLOW_STAGE_REQUIRES_COMMENT",
                message="Current stage requires comment",
                details={
                    "currentStageId": str(stage.id),
                    "currentStageInstanceId": str(instance.id),
                },
            )
        if (
            stage.requires_attachment
            and self._count_stage_attachments(instance.id) == 0
        ):
            raise workflow_error(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="WORKFLOW_STAGE_REQUIRES_ATTACHMENT",
                message="Current stage requires attachment",
                details={
                    "currentStageId": str(stage.id),
                    "currentStageInstanceId": str(instance.id),
                },
            )
        missing = (
            self.db.scalar(
                select(func.count())
                .select_from(PlaybookChecklistItem)
                .outerjoin(
                    ProgramChecklistValue,
                    (
                        ProgramChecklistValue.checklist_item_id
                        == PlaybookChecklistItem.id
                    )
                    & (ProgramChecklistValue.stage_instance_id == instance.id),
                )
                .where(
                    PlaybookChecklistItem.workflow_stage_id == stage.id,
                    PlaybookChecklistItem.required.is_(True),
                    (ProgramChecklistValue.id.is_(None))
                    | (ProgramChecklistValue.is_done.is_(False)),
                )
            )
            or 0
        )
        if missing:
            raise workflow_error(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="WORKFLOW_CHECKLIST_INCOMPLETE",
                message="Required checklist items are incomplete",
                details={"currentStageId": str(stage.id), "missingCount": missing},
            )
        performed_by = self._get_performed_by(payload)
        if self.db.get(User, performed_by) is None:
            raise workflow_error(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="WORKFLOW_PERFORMER_NOT_FOUND",
                message="Transition performer not found",
                details={"performedBy": str(performed_by)},
            )

    def _get_performed_by(self, payload: WorkflowTransitionExecute) -> UUID:
        if payload.performed_by is None:
            raise workflow_error(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="WORKFLOW_PERFORMER_REQUIRED",
                message="Transition performer is required",
            )
        return payload.performed_by

    def _get_stage_instance(
        self, interaction_id: UUID, stage_id: UUID
    ) -> WorkflowStageInstance:
        statement = (
            select(WorkflowStageInstance)
            .where(
                WorkflowStageInstance.interaction_id == interaction_id,
                WorkflowStageInstance.workflow_stage_id == stage_id,
            )
            .with_for_update()
        )
        instance = self.db.scalar(statement)
        if instance is None:
            raise workflow_error(
                status_code=status.HTTP_409_CONFLICT,
                code="WORKFLOW_TARGET_STAGE_INSTANCE_NOT_FOUND",
                message="Target stage instance not found",
                details={
                    "targetStageId": str(stage_id),
                    "interactionId": str(interaction_id),
                },
            )
        return instance

    def _count_stage_attachments(self, stage_instance_id: UUID) -> int:
        statement = (
            select(func.count())
            .select_from(WorkflowStageAttachment)
            .join(File, File.id == WorkflowStageAttachment.file_id)
            .where(
                WorkflowStageAttachment.stage_instance_id == stage_instance_id,
                File.deleted_at.is_(None),
                File.purged_at.is_(None),
            )
        )
        return self.db.scalar(statement) or 0

    def _calculate_due_at(
        self, started_at: datetime, stage: WorkflowStage
    ) -> datetime | None:
        if stage.default_duration_days is None:
            return None
        return started_at + timedelta(days=stage.default_duration_days)

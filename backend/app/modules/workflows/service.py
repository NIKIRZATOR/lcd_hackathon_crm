from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.interactions.model import UniversityInteraction
from app.modules.users.model import User
from app.modules.workflows.model import (
    WorkflowStage,
    WorkflowStageAttachment,
    WorkflowStageInstance,
    WorkflowTemplate,
    WorkflowTransition,
    WorkflowTransitionHistory,
    WorkflowVersion,
)
from app.modules.workflows.repository import (
    WorkflowStageInstanceRepository,
    WorkflowStageRepository,
    WorkflowTemplateRepository,
    WorkflowTransitionHistoryRepository,
    WorkflowTransitionRepository,
    WorkflowVersionRepository,
)
from app.modules.workflows.schemas import (
    WorkflowStageCreate,
    WorkflowStageInstanceStatusUpdate,
    WorkflowStageUpdate,
    WorkflowTemplateCreate,
    WorkflowTemplateUpdate,
    WorkflowTransitionCreate,
    WorkflowTransitionExecute,
    WorkflowTransitionResult,
    WorkflowTransitionUpdate,
)

TERMINAL_INTERACTION_STATUSES = {"COMPLETED", "CANCELLED", "ARCHIVED"}


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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow template not found")
        return template

    def create_template(self, payload: WorkflowTemplateCreate) -> WorkflowTemplate:
        if payload.created_by is not None and self.db.get(User, payload.created_by) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template creator not found")
        template = WorkflowTemplate(**payload.model_dump())
        self.repository.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def update_template(self, template_id: UUID, payload: WorkflowTemplateUpdate) -> WorkflowTemplate:
        template = self.get_template(template_id)
        if payload.created_by is not None and self.db.get(User, payload.created_by) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template creator not found")
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

    def create_draft(self, template_id: UUID, *, created_by: UUID | None) -> WorkflowVersion:
        self._get_template(template_id)
        existing_draft = self.db.scalar(
            select(WorkflowVersion).where(
                WorkflowVersion.workflow_template_id == template_id,
                WorkflowVersion.status == "DRAFT",
            )
        )
        if existing_draft is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Workflow draft already exists")

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

        self.db.commit()
        self.db.refresh(draft)
        return draft

    def publish_version(self, version_id: UUID) -> WorkflowVersion:
        version = self.db.get(WorkflowVersion, version_id)
        if version is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow version not found")
        if version.status != "DRAFT":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft workflow version can be published")
        stages = self.stage_repository.list_active_by_version(version.id)
        if not stages:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow version has no active stages")

        now = datetime.now(timezone.utc)
        current = self.version_repository.get_current_published(version.workflow_template_id)
        if current is not None:
            current.status = "ARCHIVED"
            current.archived_at = now

        version.status = "PUBLISHED"
        version.published_at = now
        self.db.commit()
        self.db.refresh(version)
        return version

    def _get_template(self, template_id: UUID) -> WorkflowTemplate:
        template = self.template_repository.get(template_id)
        if template is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow template not found")
        return template

    def _get_next_version_number(self, template_id: UUID) -> int:
        current_max = self.db.scalar(
            select(func.max(WorkflowVersion.version)).where(WorkflowVersion.workflow_template_id == template_id)
        )
        return (current_max or 0) + 1

    def _clone_version_structure(self, source: WorkflowVersion, draft: WorkflowVersion) -> None:
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
            select(WorkflowTransition).where(WorkflowTransition.workflow_version_id == source.id)
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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow stage not found")
        return stage

    def create_stage(self, payload: WorkflowStageCreate) -> WorkflowStage:
        workflow_version_id = self._resolve_draft_version(payload.workflow_template_id, payload.workflow_version_id)
        stage = WorkflowStage(**payload.model_dump(exclude={"workflow_version_id"}), workflow_version_id=workflow_version_id)
        self.repository.add(stage)
        self.db.commit()
        self.db.refresh(stage)
        return stage

    def update_stage(self, stage_id: UUID, payload: WorkflowStageUpdate) -> WorkflowStage:
        stage = self.get_stage(stage_id)
        self._ensure_version_is_draft(stage.workflow_version_id)
        if payload.workflow_template_id is not None:
            self._validate_template(payload.workflow_template_id)
        if payload.workflow_version_id is not None:
            self._validate_version(payload.workflow_template_id or stage.workflow_template_id, payload.workflow_version_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(stage, field, value)
        self.db.commit()
        self.db.refresh(stage)
        return stage

    def _validate_template(self, template_id: UUID) -> None:
        if self.db.get(WorkflowTemplate, template_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow template not found")

    def _resolve_draft_version(self, template_id: UUID, version_id: UUID | None) -> UUID:
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
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Create draft before editing workflow stages")
        return draft.id

    def _validate_version(self, template_id: UUID, version_id: UUID) -> WorkflowVersion:
        version = self.db.get(WorkflowVersion, version_id)
        if version is None or version.workflow_template_id != template_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow version not found")
        return version

    def _ensure_version_is_draft(self, version_id: UUID) -> None:
        version = self.db.get(WorkflowVersion, version_id)
        if version is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow version not found")
        if version.status != "DRAFT":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Published workflow version is immutable")


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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow transition not found")
        return transition

    def create_transition(self, payload: WorkflowTransitionCreate) -> WorkflowTransition:
        workflow_version_id = self._resolve_draft_version(payload.workflow_template_id, payload.workflow_version_id)
        payload = payload.model_copy(update={"workflow_version_id": workflow_version_id})
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
            workflow_template_id=payload.workflow_template_id or transition.workflow_template_id,
            workflow_version_id=payload.workflow_version_id or transition.workflow_version_id,
            from_stage_id=payload.from_stage_id or transition.from_stage_id,
            to_stage_id=payload.to_stage_id or transition.to_stage_id,
            name=payload.name if payload.name is not None else transition.name,
            is_default=payload.is_default if payload.is_default is not None else transition.is_default,
            condition_code=payload.condition_code if payload.condition_code is not None else transition.condition_code,
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
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow template not found")
        if from_stage is None or to_stage is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow stage not found")
        if from_stage.workflow_template_id != payload.workflow_template_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="From stage belongs to another template")
        if to_stage.workflow_template_id != payload.workflow_template_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="To stage belongs to another template")
        if payload.workflow_version_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow version is required")
        version = self.db.get(WorkflowVersion, payload.workflow_version_id)
        if version is None or version.workflow_template_id != payload.workflow_template_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow version not found")
        if version.status != "DRAFT":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Published workflow version is immutable")
        if from_stage.workflow_version_id != payload.workflow_version_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="From stage belongs to another version")
        if to_stage.workflow_version_id != payload.workflow_version_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="To stage belongs to another version")

    def _resolve_draft_version(self, template_id: UUID, version_id: UUID | None) -> UUID:
        if self.db.get(WorkflowTemplate, template_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow template not found")
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
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Create draft before editing workflow transitions")
        return draft.id

    def _ensure_version_is_draft(self, version_id: UUID, template_id: UUID | None = None) -> None:
        version = self.db.get(WorkflowVersion, version_id)
        if version is None or (template_id is not None and version.workflow_template_id != template_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow version not found")
        if version.status != "DRAFT":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Published workflow version is immutable")


class WorkflowRuntimeService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.stage_repository = WorkflowStageRepository(db)
        self.instance_repository = WorkflowStageInstanceRepository(db)
        self.transition_repository = WorkflowTransitionRepository(db)
        self.history_repository = WorkflowTransitionHistoryRepository(db)

    def validate_template_has_stages(self, template_id: UUID) -> None:
        version = WorkflowVersionService(self.db).get_current_published_version(template_id)
        stages = self.stage_repository.list_active_by_version(version.id)
        if not stages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow template has no active stages",
            )

    def initialize_interaction_workflow(self, interaction: UniversityInteraction) -> None:
        if interaction.workflow_template_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow template is required")
        if interaction.workflow_version_id is None:
            interaction.workflow_version_id = WorkflowVersionService(self.db).get_current_published_version(
                interaction.workflow_template_id
            ).id

        stages = self.stage_repository.list_active_by_version(interaction.workflow_version_id)
        if not stages:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow template has no active stages")

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

        interaction.current_stage_instance_id = instances[initial_stage.id].id

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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University interaction not found")
        if interaction.current_stage_instance_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Interaction has no current stage")
        instance = self.db.get(WorkflowStageInstance, interaction.current_stage_instance_id)
        if instance is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current stage instance not found")
        return instance

    def update_stage_instance_status(
        self,
        stage_instance_id: UUID,
        payload: WorkflowStageInstanceStatusUpdate,
    ) -> WorkflowStageInstance:
        instance = self.instance_repository.get(stage_instance_id)
        if instance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow stage instance not found")
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

    def execute_transition(
        self,
        interaction_id: UUID,
        payload: WorkflowTransitionExecute,
    ) -> WorkflowTransitionResult:
        interaction = self.db.get(UniversityInteraction, interaction_id)
        if interaction is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University interaction not found")
        if interaction.status in TERMINAL_INTERACTION_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Interaction is already terminal")
        if interaction.workflow_template_id is None or interaction.current_stage_instance_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Interaction workflow is not initialized")
        if interaction.workflow_version_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Interaction workflow version is not initialized")

        current_instance = self.db.get(WorkflowStageInstance, interaction.current_stage_instance_id)
        if current_instance is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current stage instance not found")
        current_stage = self.db.get(WorkflowStage, current_instance.workflow_stage_id)
        if current_stage is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current workflow stage not found")
        if current_instance.status not in {"IN_PROGRESS", "WAITING", "BLOCKED"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current stage is not active")

        transition = self.transition_repository.get_allowed_transition(
            transition_id=payload.transition_id,
            template_id=interaction.workflow_template_id,
            version_id=interaction.workflow_version_id,
            from_stage_id=current_stage.id,
        )
        if transition is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transition is not allowed")

        if payload.skip_current and not current_stage.is_optional:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only optional stages can be skipped")

        self._validate_stage_requirements(current_stage, current_instance, payload)

        next_instance = self._get_stage_instance(interaction.id, transition.to_stage_id)
        now = datetime.now(timezone.utc)
        next_stage = self.db.get(WorkflowStage, transition.to_stage_id)
        if next_stage is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target workflow stage not found")

        try:
            current_instance.status = "SKIPPED" if payload.skip_current else "COMPLETED"
            current_instance.completed_at = None if payload.skip_current else now
            current_instance.skipped_at = now if payload.skip_current else None

            next_instance.status = "IN_PROGRESS"
            next_instance.started_at = next_instance.started_at or now
            next_instance.due_at = next_instance.due_at or self._calculate_due_at(now, next_stage)

            history = WorkflowTransitionHistory(
                interaction_id=interaction.id,
                from_stage_instance_id=current_instance.id,
                to_stage_instance_id=next_instance.id,
                transition_id=transition.id,
                performed_by=payload.performed_by,
                comment=payload.comment,
                performed_at=now,
            )
            self.history_repository.add(history)
            interaction.current_stage_instance_id = next_instance.id

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

    def _validate_stage_requirements(
        self,
        stage: WorkflowStage,
        instance: WorkflowStageInstance,
        payload: WorkflowTransitionExecute,
    ) -> None:
        if stage.requires_comment and not (payload.comment and payload.comment.strip()):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current stage requires comment")
        if stage.requires_attachment and self._count_stage_attachments(instance.id) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current stage requires attachment")
        if self.db.get(User, payload.performed_by) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transition performer not found")

    def _get_stage_instance(self, interaction_id: UUID, stage_id: UUID) -> WorkflowStageInstance:
        statement = select(WorkflowStageInstance).where(
            WorkflowStageInstance.interaction_id == interaction_id,
            WorkflowStageInstance.workflow_stage_id == stage_id,
        )
        instance = self.db.scalar(statement)
        if instance is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target stage instance not found")
        return instance

    def _count_stage_attachments(self, stage_instance_id: UUID) -> int:
        statement = select(func.count()).select_from(WorkflowStageAttachment).where(
            WorkflowStageAttachment.stage_instance_id == stage_instance_id
        )
        return self.db.scalar(statement) or 0

    def _calculate_due_at(self, started_at: datetime, stage: WorkflowStage) -> datetime | None:
        if stage.default_duration_days is None:
            return None
        return started_at + timedelta(days=stage.default_duration_days)

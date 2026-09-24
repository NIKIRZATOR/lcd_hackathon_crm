from uuid import UUID

from sqlalchemy import select

from app.common.repository import CRUDRepository
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


class WorkflowTemplateRepository(CRUDRepository[WorkflowTemplate]):
    model = WorkflowTemplate
    sortable_fields = {"name", "version", "is_active", "is_default", "created_at", "updated_at"}
    default_sort = "name"


class WorkflowVersionRepository(CRUDRepository[WorkflowVersion]):
    model = WorkflowVersion
    sortable_fields = {"version", "status", "published_at", "created_at", "updated_at"}
    default_sort = "version"

    def list_by_template(self, template_id: UUID) -> list[WorkflowVersion]:
        statement = (
            select(WorkflowVersion)
            .where(WorkflowVersion.workflow_template_id == template_id)
            .order_by(WorkflowVersion.version)
        )
        return list(self.db.scalars(statement).all())

    def get_current_published(self, template_id: UUID) -> WorkflowVersion | None:
        statement = (
            select(WorkflowVersion)
            .where(
                WorkflowVersion.workflow_template_id == template_id,
                WorkflowVersion.status == "PUBLISHED",
            )
            .order_by(WorkflowVersion.version.desc())
        )
        return self.db.scalar(statement)


class WorkflowStageRepository(CRUDRepository[WorkflowStage]):
    model = WorkflowStage
    sortable_fields = {"name", "order_index", "is_active", "created_at", "updated_at"}
    default_sort = "order_index"

    def list_active_by_template(self, template_id: UUID) -> list[WorkflowStage]:
        statement = (
            select(WorkflowStage)
            .where(WorkflowStage.workflow_template_id == template_id, WorkflowStage.is_active.is_(True))
            .order_by(WorkflowStage.order_index)
        )
        return list(self.db.scalars(statement).all())

    def list_active_by_version(self, version_id: UUID) -> list[WorkflowStage]:
        statement = (
            select(WorkflowStage)
            .where(WorkflowStage.workflow_version_id == version_id, WorkflowStage.is_active.is_(True))
            .order_by(WorkflowStage.order_index)
        )
        return list(self.db.scalars(statement).all())


class WorkflowTransitionRepository(CRUDRepository[WorkflowTransition]):
    model = WorkflowTransition
    sortable_fields = {"name", "is_default", "created_at", "updated_at"}
    default_sort = "created_at"

    def get_allowed_transition(
        self,
        *,
        transition_id: UUID,
        template_id: UUID,
        version_id: UUID | None = None,
        from_stage_id: UUID,
    ) -> WorkflowTransition | None:
        statement = select(WorkflowTransition).where(
            WorkflowTransition.id == transition_id,
            WorkflowTransition.workflow_template_id == template_id,
            WorkflowTransition.from_stage_id == from_stage_id,
        )
        if version_id is not None:
            statement = statement.where(WorkflowTransition.workflow_version_id == version_id)
        return self.db.scalar(statement)

    def list_by_version(self, version_id: UUID) -> list[WorkflowTransition]:
        statement = select(WorkflowTransition).where(WorkflowTransition.workflow_version_id == version_id)
        return list(self.db.scalars(statement).all())

    def list_from_stage(self, *, version_id: UUID, from_stage_id: UUID) -> list[WorkflowTransition]:
        statement = (
            select(WorkflowTransition)
            .where(
                WorkflowTransition.workflow_version_id == version_id,
                WorkflowTransition.from_stage_id == from_stage_id,
            )
            .order_by(WorkflowTransition.is_default.desc(), WorkflowTransition.created_at)
        )
        return list(self.db.scalars(statement).all())


class WorkflowChangeRequestRepository(CRUDRepository[WorkflowChangeRequest]):
    model = WorkflowChangeRequest
    sortable_fields = {"status", "requested_at", "reviewed_at", "created_at", "updated_at"}
    default_sort = "created_at"

    def get_approved_for_version(self, workflow_version_id: UUID) -> WorkflowChangeRequest | None:
        statement = select(WorkflowChangeRequest).where(
            WorkflowChangeRequest.workflow_version_id == workflow_version_id,
            WorkflowChangeRequest.status == "APPROVED",
        )
        return self.db.scalar(statement)


class WorkflowStageMappingRepository(CRUDRepository[WorkflowStageMapping]):
    model = WorkflowStageMapping
    sortable_fields = {"created_at", "updated_at"}
    default_sort = "created_at"

    def list_by_versions(self, source_version_id: UUID, target_version_id: UUID) -> list[WorkflowStageMapping]:
        statement = select(WorkflowStageMapping).where(
            WorkflowStageMapping.source_version_id == source_version_id,
            WorkflowStageMapping.target_version_id == target_version_id,
        )
        return list(self.db.scalars(statement).all())


class WorkflowMigrationJobRepository(CRUDRepository[WorkflowMigrationJob]):
    model = WorkflowMigrationJob
    sortable_fields = {"status", "created_at", "updated_at", "completed_at"}
    default_sort = "created_at"

class WorkflowStageInstanceRepository(CRUDRepository[WorkflowStageInstance]):
    model = WorkflowStageInstance
    sortable_fields = {"status", "started_at", "due_at", "completed_at", "skipped_at", "created_at", "updated_at"}
    default_sort = "created_at"


class WorkflowTransitionHistoryRepository(CRUDRepository[WorkflowTransitionHistory]):
    model = WorkflowTransitionHistory
    sortable_fields = {"performed_at", "created_at", "updated_at"}
    default_sort = "performed_at"


class WorkflowStageAttachmentRepository(CRUDRepository[WorkflowStageAttachment]):
    model = WorkflowStageAttachment

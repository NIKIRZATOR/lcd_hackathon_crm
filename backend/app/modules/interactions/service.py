from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.interactions.model import InteractionContact, UniversityInteraction
from app.modules.interactions.repository import UniversityInteractionRepository
from app.modules.interactions.schemas import UniversityInteractionAssign, UniversityInteractionCreate, UniversityInteractionUpdate
from app.modules.products.model import ITProduct
from app.modules.programs.model import ITProgram
from app.modules.universities.model import University
from app.modules.users.model import ResponsibleAssignmentHistory, User
from app.modules.workflows.model import WorkflowTemplate
from app.modules.workflows.model import (
    WorkflowStageAttachment,
    WorkflowStageComment,
    WorkflowStageInstance,
    WorkflowTransitionHistory,
)
from app.modules.workflows.service import WorkflowRuntimeService


class UniversityInteractionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = UniversityInteractionRepository(db)

    def list_interactions(
        self,
        *,
        university_id: UUID | None,
        program_id: UUID | None,
        product_id: UUID | None,
        manager_user_id: UUID | set[UUID] | None,
        status_value: str | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[UniversityInteraction]:
        return self.repository.list_with_manager_scope(
            university_id=university_id,
            program_id=program_id,
            product_id=product_id,
            manager_user_id=manager_user_id,
            status_value=status_value,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_interaction(self, interaction_id: UUID) -> UniversityInteraction:
        interaction = self.repository.get(interaction_id)
        if interaction is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University interaction not found")
        return interaction

    def create_interaction(self, payload: UniversityInteractionCreate) -> UniversityInteraction:
        self._validate_related_entities(payload)
        runtime = WorkflowRuntimeService(self.db)
        runtime.validate_template_has_stages(payload.workflow_template_id)

        interaction = UniversityInteraction(
            **payload.model_dump(exclude={"started_at"}),
            started_at=payload.started_at or datetime.now(timezone.utc),
        )

        try:
            self.repository.add(interaction)
            runtime.initialize_interaction_workflow(interaction)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        self.db.refresh(interaction)
        return interaction

    def update_interaction(
        self,
        interaction_id: UUID,
        payload: UniversityInteractionUpdate,
        *,
        changed_by_user_id: UUID | None = None,
    ) -> UniversityInteraction:
        interaction = self.get_interaction(interaction_id)
        old_manager_user_id = interaction.manager_user_id
        self._validate_related_entities(payload)
        if (
            payload.workflow_template_id is not None
            and payload.workflow_template_id != interaction.workflow_template_id
            and interaction.current_stage_instance_id is not None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change workflow template after workflow initialization",
            )

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(interaction, field, value)

        if payload.manager_user_id is not None and payload.manager_user_id != old_manager_user_id:
            if changed_by_user_id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assignment change performer is required",
                )
            self.db.add(
                ResponsibleAssignmentHistory(
                    interaction_id=interaction.id,
                    old_manager_user_id=old_manager_user_id,
                    new_manager_user_id=payload.manager_user_id,
                    changed_by_user_id=changed_by_user_id,
                )
            )

        self.db.commit()
        self.db.refresh(interaction)
        return interaction

    def assign_interaction(
        self,
        interaction_id: UUID,
        payload: UniversityInteractionAssign,
        *,
        changed_by_user_id: UUID,
    ) -> UniversityInteraction:
        interaction = self.get_interaction(interaction_id)
        old_manager_user_id = interaction.manager_user_id

        if payload.manager_user_id is not None and self.db.get(User, payload.manager_user_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manager user not found")

        if payload.manager_user_id == old_manager_user_id:
            return interaction

        interaction.manager_user_id = payload.manager_user_id
        self.db.add(
            ResponsibleAssignmentHistory(
                interaction_id=interaction.id,
                old_manager_user_id=old_manager_user_id,
                new_manager_user_id=payload.manager_user_id,
                changed_by_user_id=changed_by_user_id,
                reason=payload.reason,
            )
        )
        self.db.execute(
            update(WorkflowStageInstance)
            .where(
                WorkflowStageInstance.interaction_id == interaction.id,
                WorkflowStageInstance.status.in_(["NOT_STARTED", "IN_PROGRESS", "WAITING", "BLOCKED"]),
            )
            .values(responsible_user_id=payload.manager_user_id)
        )
        self.db.commit()
        self.db.refresh(interaction)
        return interaction

    def delete_interaction(self, interaction_id: UUID) -> None:
        interaction = self.get_interaction(interaction_id)
        stage_instance_ids = self.db.scalars(
            select(WorkflowStageInstance.id).where(WorkflowStageInstance.interaction_id == interaction_id)
        ).all()

        if stage_instance_ids:
            self.db.execute(
                delete(WorkflowStageAttachment).where(
                    WorkflowStageAttachment.stage_instance_id.in_(stage_instance_ids)
                )
            )
            self.db.execute(
                delete(WorkflowStageComment).where(WorkflowStageComment.stage_instance_id.in_(stage_instance_ids))
            )

        self.db.execute(
            delete(WorkflowTransitionHistory).where(WorkflowTransitionHistory.interaction_id == interaction_id)
        )
        self.db.execute(
            update(UniversityInteraction)
            .where(UniversityInteraction.id == interaction_id)
            .values(current_stage_instance_id=None)
        )
        self.db.execute(delete(WorkflowStageInstance).where(WorkflowStageInstance.interaction_id == interaction_id))
        self.db.execute(delete(InteractionContact).where(InteractionContact.interaction_id == interaction_id))
        self.repository.delete(interaction)
        self.db.commit()

    def _validate_related_entities(
        self,
        payload: UniversityInteractionCreate | UniversityInteractionUpdate,
    ) -> None:
        checks = [
            ("university_id", University, "University not found"),
            ("program_id", ITProgram, "IT program not found"),
            ("product_id", ITProduct, "IT product not found"),
            ("manager_user_id", User, "Manager user not found"),
            ("workflow_template_id", WorkflowTemplate, "Workflow template not found"),
        ]

        for field, model, message in checks:
            value = getattr(payload, field, None)
            if value is not None and self.db.get(model, value) is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

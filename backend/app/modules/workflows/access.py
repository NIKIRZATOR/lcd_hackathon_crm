from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.auth.access import ensure_can_read_interaction
from app.modules.interactions.model import UniversityInteraction
from app.modules.organizations.service import OrganizationService
from app.modules.program_instances.model import ProgramInstance
from app.modules.users.model import User
from app.modules.workflows.model import WorkflowStageInstance


def ensure_can_access_stage_instance(
    db: Session, current_user: User, stage_instance_id: UUID
) -> WorkflowStageInstance:
    instance = db.get(WorkflowStageInstance, stage_instance_id)
    if instance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow stage instance not found",
        )

    if instance.program_instance_id is not None:
        program = db.get(ProgramInstance, instance.program_instance_id)
        if program is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Program instance not found",
            )
        OrganizationService(db).get(program.organization_id, current_user)
        return instance

    if instance.interaction_id is not None:
        interaction = db.get(UniversityInteraction, instance.interaction_id)
        if interaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="University interaction not found",
            )
        ensure_can_read_interaction(db, current_user, interaction)
        return instance

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Workflow stage owner not found",
    )

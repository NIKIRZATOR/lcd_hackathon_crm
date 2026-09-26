from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.checklists.model import PlaybookChecklistItem, ProgramChecklistValue
from app.modules.health.service import HealthService
from app.modules.nba.service import NbaService
from app.modules.interactions.model import UniversityInteraction
from app.modules.program_instances.model import AcademicWindow, ProgramInstance
from app.modules.program_instances.schemas import (
    AcademicWindowRead,
    OrganizationHealthRead,
    WorkflowJournalRead,
    ProgramInstanceRead,
    ProgramInstanceStart,
)
from app.modules.program_instances.service import ProgramInstanceService
from app.modules.users.model import User
from app.modules.workflow_catalog.model import WorkflowPhase, WorkflowStageCatalog
from app.modules.workflows.model import WorkflowStage, WorkflowStageInstance, WorkflowTransitionHistory
from app.modules.workflows.schemas import WorkflowTransitionExecute
from app.modules.workflows.service import TransitionService, WorkflowRuntimeService

router = APIRouter(
    tags=["program_instances"], dependencies=[Depends(require_roles(*CRM_ROLES))]
)


@router.get("/academic-windows", response_model=list[AcademicWindowRead])
def list_academic_windows(db: Session = Depends(get_db_session)):
    return list(
        db.scalars(
            select(AcademicWindow).order_by(AcademicWindow.classes_start_on)
        ).all()
    )

@router.get("/workflow-journal", response_model=list[WorkflowJournalRead])
def workflow_journal(preset: str = "all", db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    if preset not in {"all", "overdue", "semester", "renewal", "lms_silence"}:
        raise HTTPException(status_code=422, detail="Unknown journal preset")
    return ProgramInstanceService(db).workflow_journal(current_user, preset)


@router.get(
    "/organizations/{organization_id}/program-instances",
    response_model=Page[ProgramInstanceRead],
)
def list_program_instances(
    organization_id: UUID,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    result = ProgramInstanceService(db).list_for_organization(
        organization_id, current_user, pagination.limit, pagination.offset
    )
    return Page(
        items=result[0],
        total=result[1],
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get("/organizations/{organization_id}/available-playbooks")
def available_playbooks(
    organization_id: UUID,
    direction_id: UUID | None = None,
    product_id: UUID | None = None,
    parent_program_id: UUID | None = None,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    return ProgramInstanceService(db).available_playbooks(
        organization_id, current_user, direction_id, product_id, parent_program_id
    )


@router.get(
    "/program-instances/{program_instance_id}", response_model=ProgramInstanceRead
)
def get_program_instance(
    program_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    return ProgramInstanceService(db).get(program_instance_id, current_user)


@router.post(
    "/program-instances/{program_instance_id}/health/recompute",
    response_model=ProgramInstanceRead,
)
def recompute_program_health(
    program_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    ProgramInstanceService(db).get(program_instance_id, current_user)
    HealthService(db).recompute(program_instance_id)
    db.commit()
    return ProgramInstanceService(db).get(program_instance_id, current_user)


@router.get(
    "/organizations/{organization_id}/health", response_model=OrganizationHealthRead
)
def get_organization_health(
    organization_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    return ProgramInstanceService(db).health_summary(organization_id, current_user)


@router.get("/program-instances/{program_instance_id}/checklist")
def get_program_instance_checklist(
    program_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    program_read = ProgramInstanceService(db).get(program_instance_id, current_user)
    program = db.get(ProgramInstance, program_instance_id)
    assert program is not None
    stage_instance_id = program.current_stage_instance_id
    if stage_instance_id is None and program_read.legacy_interaction_id is not None:
        interaction = db.get(UniversityInteraction, program_read.legacy_interaction_id)
        stage_instance_id = (
            interaction.current_stage_instance_id if interaction is not None else None
        )
    if stage_instance_id is None:
        return []
    stage_instance = db.get(WorkflowStageInstance, stage_instance_id)
    if stage_instance is None:
        raise HTTPException(status_code=404, detail="Current workflow stage not found")
    rows = db.execute(
        select(ProgramChecklistValue, PlaybookChecklistItem)
        .join(
            PlaybookChecklistItem,
            PlaybookChecklistItem.id == ProgramChecklistValue.checklist_item_id,
        )
        .where(ProgramChecklistValue.stage_instance_id == stage_instance.id)
    ).all()
    return [
        {
            "id": str(value.id),
            "label": item.label,
            "item_type": item.item_type,
            "required": item.required,
            "is_done": value.is_done,
            "value_text": value.value_text,
        }
        for value, item in rows
    ]


@router.get("/program-instances/{program_instance_id}/workflow")
def get_program_instance_workflow(
    program_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    program = ProgramInstanceService(db).get(program_instance_id, current_user)
    if program.legacy_interaction_id is None:
        model = db.get(ProgramInstance, program_instance_id)
        rows = db.execute(
            select(
                WorkflowStageInstance,
                WorkflowStage,
                WorkflowStageCatalog,
                WorkflowPhase,
            )
            .join(
                WorkflowStage,
                WorkflowStage.id == WorkflowStageInstance.workflow_stage_id,
            )
            .outerjoin(
                WorkflowStageCatalog,
                WorkflowStageCatalog.id == WorkflowStage.stage_catalog_id,
            )
            .outerjoin(
                WorkflowPhase, WorkflowPhase.id == WorkflowStageCatalog.default_phase_id
            )
            .where(WorkflowStageInstance.program_instance_id == program_instance_id)
            .order_by(WorkflowStage.order_index)
        ).all()
        transitions = WorkflowRuntimeService(db).list_available_program_transitions(
            model
        )
        history = db.scalars(
            select(WorkflowTransitionHistory)
            .where(WorkflowTransitionHistory.program_instance_id == program_instance_id)
            .order_by(WorkflowTransitionHistory.performed_at.desc())
        ).all()
        return {
            "stages": [
                {
                    "id": str(instance.id),
                    "status": instance.status,
                    "due_at": instance.due_at,
                    "code": catalog.code if catalog else stage.name,
                    "name": stage.name,
                    "phase_code": phase.code if phase else "other",
                    "phase_name": phase.name if phase else "Other",
                    "order_index": stage.order_index,
                    "is_optional": stage.is_optional,
                    "is_final": stage.is_final,
                }
                for instance, stage, catalog, phase in rows
            ],
            "current_stage_instance_id": str(model.current_stage_instance_id)
            if model.current_stage_instance_id
            else None,
            "available_transitions": [
                {
                    "id": str(item.id),
                    "name": item.name,
                    "to_stage_name": item.to_stage.name,
                }
                for item in transitions
            ],
            "transition_history": [
                {"id": str(item.id), "comment": item.comment, "performed_at": item.performed_at}
                for item in history
            ],
        }
    interaction = db.get(UniversityInteraction, program.legacy_interaction_id)
    if interaction is None:
        return {
            "stages": [],
            "current_stage_instance_id": None,
            "available_transitions": [],
        }
    rows = db.execute(
        select(
            WorkflowStageInstance, WorkflowStage, WorkflowStageCatalog, WorkflowPhase
        )
        .join(
            WorkflowStage, WorkflowStage.id == WorkflowStageInstance.workflow_stage_id
        )
        .outerjoin(
            WorkflowStageCatalog,
            WorkflowStageCatalog.id == WorkflowStage.stage_catalog_id,
        )
        .outerjoin(
            WorkflowPhase, WorkflowPhase.id == WorkflowStageCatalog.default_phase_id
        )
        .where(WorkflowStageInstance.interaction_id == interaction.id)
        .order_by(WorkflowStage.order_index)
    ).all()
    transitions = WorkflowRuntimeService(db).list_available_transitions(interaction.id)
    return {
        "stages": [
            {
                "id": str(instance.id),
                "status": instance.status,
                "due_at": instance.due_at,
                "code": catalog.code if catalog else stage.name,
                "name": stage.name,
                "phase_code": phase.code if phase else "other",
                "phase_name": phase.name if phase else "Other",
                "order_index": stage.order_index,
                "is_optional": stage.is_optional,
                "is_final": stage.is_final,
            }
            for instance, stage, catalog, phase in rows
        ],
        "current_stage_instance_id": str(interaction.current_stage_instance_id)
        if interaction.current_stage_instance_id
        else None,
        "available_transitions": [
            {
                "id": str(transition.id),
                "name": transition.name,
                "to_stage_name": transition.to_stage.name,
            }
            for transition in transitions
        ],
    }


@router.post("/program-instances/{program_instance_id}/transition")
def transition_program_instance(
    program_instance_id: UUID,
    payload: WorkflowTransitionExecute,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    program = ProgramInstanceService(db).get(program_instance_id, current_user)
    if program.legacy_interaction_id is None:
        model = db.get(ProgramInstance, program_instance_id)
        result = TransitionService(db).execute_program_transition(
            model, payload.model_copy(update={"performed_by": current_user.id})
        )
        next_instance = db.get(WorkflowStageInstance, model.current_stage_instance_id)
        if next_instance is not None:
            next_stage = db.get(WorkflowStage, next_instance.workflow_stage_id)
            catalog = (
                db.get(WorkflowStageCatalog, next_stage.stage_catalog_id)
                if next_stage and next_stage.stage_catalog_id
                else None
            )
            if catalog:
                model.current_stage_code = catalog.code
        HealthService(db).recompute(program_instance_id)
        NbaService(db).recompute_program(program_instance_id)
        db.commit()
        return result
    scoped_payload = payload.model_copy(update={"performed_by": current_user.id})
    result = WorkflowRuntimeService(db).execute_transition(
        program.legacy_interaction_id, scoped_payload
    )
    next_instance = db.get(WorkflowStageInstance, result.current_stage_instance_id)
    if next_instance is not None:
        next_stage = db.get(WorkflowStage, next_instance.workflow_stage_id)
        if next_stage is not None and next_stage.stage_catalog_id is not None:
            catalog = db.get(WorkflowStageCatalog, next_stage.stage_catalog_id)
            if catalog is not None:
                db.get(
                    ProgramInstance, program_instance_id
                ).current_stage_code = catalog.code
                db.commit()
    HealthService(db).recompute(program_instance_id)
    NbaService(db).recompute_program(program_instance_id)
    return result


@router.post(
    "/organizations/{organization_id}/program-instances",
    response_model=ProgramInstanceRead,
    status_code=201,
)
def start_program_instance(
    organization_id: UUID,
    payload: ProgramInstanceStart,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    return ProgramInstanceService(db).start(organization_id, payload, current_user)

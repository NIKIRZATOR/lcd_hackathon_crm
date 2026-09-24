from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.workflow_catalog.model import WorkflowPhase, WorkflowStageCatalog
from app.modules.workflows.model import WorkflowTemplate, WorkflowVersion

router = APIRouter(prefix="/management", tags=["management"], dependencies=[Depends(require_roles(*CRM_ROLES))])

@router.get("/stages")
def list_stages(db: Session = Depends(get_db_session)):
    rows = db.execute(select(WorkflowStageCatalog.code, WorkflowStageCatalog.name, WorkflowPhase.code.label("phase")).join(WorkflowPhase, WorkflowPhase.id == WorkflowStageCatalog.default_phase_id).order_by(WorkflowStageCatalog.code)).all()
    return [{"code": row.code, "name": row.name, "phase": row.phase} for row in rows]


@router.get("/playbooks")
def list_playbooks(db: Session = Depends(get_db_session)):
    rows = db.execute(
        select(
            WorkflowTemplate.id,
            WorkflowTemplate.code,
            WorkflowTemplate.name,
            WorkflowTemplate.applies_to_type,
            WorkflowTemplate.status,
            WorkflowVersion.version.label("published_version"),
        )
        .outerjoin(
            WorkflowVersion,
            (WorkflowVersion.workflow_template_id == WorkflowTemplate.id)
            & (WorkflowVersion.status == "PUBLISHED"),
        )
        .order_by(WorkflowTemplate.code)
    ).all()
    return [
        {
            "id": str(row.id),
            "code": row.code,
            "name": row.name,
            "applies_to_type": row.applies_to_type,
            "status": row.status,
            "published_version": row.published_version,
        }
        for row in rows
    ]

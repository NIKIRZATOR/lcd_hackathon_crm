from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.nba.schemas import NbaItemRead
from app.modules.nba.service import NbaService
from app.modules.integrations.model import IntegrationSignal
from app.modules.imports.model import ImportJob
from app.modules.reports.model import ReportJob
from app.modules.workflows.model import WorkflowTemplate
from app.modules.program_instances.service import ProgramInstanceService
from app.modules.users.model import User

router = APIRouter(prefix="/nba", tags=["nba"], dependencies=[Depends(require_roles(*CRM_ROLES))])


@router.get("/today", response_model=list[NbaItemRead])
def list_today(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    return NbaService(db).today(current_user)


@router.get("/home")
def home_summary(db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    roles = {role.name for role in current_user.roles}
    if "ADMIN" in roles:
        return {"role": "ADMIN", "cards": {"integration_errors": db.scalar(select(func.count()).select_from(IntegrationSignal).where(IntegrationSignal.status == "error")) or 0, "import_jobs": db.scalar(select(func.count()).select_from(ImportJob)) or 0, "report_jobs": db.scalar(select(func.count()).select_from(ReportJob)) or 0, "draft_playbooks": db.scalar(select(func.count()).select_from(WorkflowTemplate).where(WorkflowTemplate.status == "draft")) or 0}}
    items = NbaService(db).today(current_user)
    if "MANAGER" in roles:
        return {"role": "MANAGER", "cards": {"kam_workload": len(items), "stage_bottlenecks": sum(item["rule_code"] == "stage_overdue" for item in items), "red_yellow_organizations": len({item["organization_id"] for item in items if item["severity"] in {"critical", "high"}}), "ranking": len(items)}}
    return {"role": "KAM", "cards": {"nba_today": len(items), "health_attention": sum(item["severity"] in {"critical", "high"} for item in items)}}


@router.post("/program-instances/{program_instance_id}/recompute", response_model=list[NbaItemRead])
def recompute_program(
    program_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    ProgramInstanceService(db).get(program_instance_id, current_user)
    NbaService(db).recompute_program(program_instance_id)
    db.commit()
    return [
        item
        for item in NbaService(db).today(current_user)
        if item["program_instance_id"] == program_instance_id
    ]

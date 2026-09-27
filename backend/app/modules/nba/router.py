from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES, get_subordinate_kam_ids
from app.modules.auth.dependencies import require_roles
from app.modules.nba.admin_home_service import AdminHomeService
from app.modules.nba.schemas import NbaItemRead
from app.modules.nba.service import NbaService
from app.modules.integrations.model import ProgramMetric
from app.modules.program_instances.model import AcademicWindow, ProgramInstance
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
        return AdminHomeService(db).summary()
    items = NbaService(db).today(current_user)
    kam_ids = get_subordinate_kam_ids(db, current_user.id) if "MANAGER" in roles else {current_user.id}
    active_programs = select(ProgramInstance).where(ProgramInstance.status.in_(("draft", "active", "paused")), ProgramInstance.kam_user_id.in_(kam_ids))
    program_ids = select(ProgramInstance.id).where(ProgramInstance.status.in_(("draft", "active", "paused")), ProgramInstance.kam_user_id.in_(kam_ids))
    total = db.scalar(select(func.count()).select_from(active_programs.subquery())) or 0
    health_rows = db.execute(select(ProgramInstance.health_band, func.count()).where(ProgramInstance.id.in_(program_ids)).group_by(ProgramInstance.health_band)).all()
    health = {band: count for band, count in health_rows}
    b2c = db.execute(select(func.coalesce(func.sum(ProgramMetric.applications_count), 0), func.coalesce(func.sum(ProgramMetric.payment_records_count), 0), func.coalesce(func.sum(ProgramMetric.students_count), 0), func.coalesce(func.sum(ProgramMetric.streams_count), 0)).where(ProgramMetric.program_instance_id.in_(program_ids))).one()
    windows = db.execute(select(AcademicWindow.title, AcademicWindow.plan_cutoff_on).join(ProgramInstance, ProgramInstance.academic_window_id == AcademicWindow.id).where(ProgramInstance.id.in_(program_ids), AcademicWindow.plan_cutoff_on >= func.current_date()).order_by(AcademicWindow.plan_cutoff_on).limit(3)).all()
    base = {"portfolio": {"active_programs": total, "health": {"green": health.get("green", 0), "yellow": health.get("yellow", 0), "red": health.get("red", 0)}}, "b2c": {"applications": int(b2c[0]), "payment_records": int(b2c[1]), "students": int(b2c[2]), "streams": int(b2c[3])}, "academic_windows": [{"title": title, "plan_cutoff_on": cutoff.isoformat()} for title, cutoff in windows]}
    if "MANAGER" in roles:
        by_kam: dict[str, int] = {}
        for item in items:
            program = db.get(ProgramInstance, item["program_instance_id"]) if item["program_instance_id"] else None
            owner = db.get(User, program.kam_user_id) if program and program.kam_user_id else None
            name = owner.full_name if owner else "Без KAM"
            by_kam[name] = by_kam.get(name, 0) + 1
        return {"role": "MANAGER", "cards": {"kam_workload": len(items), "stage_bottlenecks": sum(item["rule_code"] in {"stage_overdue", "stage_overdue_8_plus"} for item in items), "organizations_without_program": sum(item["rule_code"] == "organization_without_program" for item in items), "health_attention": sum(item["severity"] in {"critical", "high"} for item in items)}, "critical_by_kam": [{"kam": name, "count": count} for name, count in sorted(by_kam.items(), key=lambda entry: entry[1], reverse=True)], **base}
    return {"role": "KAM", "cards": {"nba_today": len(items), "health_attention": sum(item["severity"] in {"critical", "high"} for item in items)}, **base}


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

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES, get_subordinate_kam_ids, has_any_role, is_admin
from app.modules.auth.dependencies import require_roles
from app.modules.integrations.model import ProgramMetric
from app.modules.licenses.model import License
from app.modules.organizations.model import OrgAssignment, Organization
from app.modules.products.model import ITProduct
from app.modules.program_instances.model import ProgramInstance
from app.modules.programs.model import ITDirection
from app.modules.users.model import User
from app.modules.workflows.model import WorkflowStage, WorkflowStageInstance, WorkflowTemplate

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_roles(*CRM_ROLES))])


class ProgramReportFilter(BaseModel):
    date_from: datetime | None = None
    date_to: datetime | None = None
    organization_ids: list[UUID] = Field(default_factory=list)
    direction_ids: list[UUID] = Field(default_factory=list)
    product_ids: list[UUID] = Field(default_factory=list)
    responsible_user_ids: list[UUID] = Field(default_factory=list)
    playbook_ids: list[UUID] = Field(default_factory=list)
    stage_ids: list[UUID] = Field(default_factory=list)
    health_bands: list[str] = Field(default_factory=list)
    statuses: list[str] = Field(default_factory=list)
    sort_by: str = "organization"
    sort_order: str = "asc"


def _scope(statement, db: Session, user: User):
    if is_admin(user):
        return statement
    kam_ids = get_subordinate_kam_ids(db, user.id) if has_any_role(user, "MANAGER") else {user.id}
    return statement.where(select(OrgAssignment.id).where(OrgAssignment.organization_id == ProgramInstance.organization_id, OrgAssignment.user_id.in_(kam_ids), OrgAssignment.status == "active").exists())


def _statement(payload: ProgramReportFilter, db: Session, user: User):
    statement = (
        select(
            ProgramInstance.id.label("id"), Organization.id.label("organization_id"), Organization.name.label("organization"),
            ITDirection.id.label("direction_id"), ITDirection.name.label("direction"), ITProduct.id.label("product_id"), ITProduct.name.label("product"),
            WorkflowTemplate.id.label("playbook_id"), WorkflowTemplate.name.label("playbook"), ProgramInstance.status.label("status"), ProgramInstance.health_band.label("health_band"), ProgramInstance.health_score.label("health_score"),
            User.id.label("responsible_id"), User.full_name.label("responsible"), WorkflowStage.id.label("stage_id"), WorkflowStage.name.label("stage"),
            License.license_number.label("license_number"), ProgramMetric.applications_count.label("applications"), ProgramMetric.payment_records_count.label("payment_records"), ProgramMetric.students_count.label("students"), ProgramMetric.streams_count.label("streams"),
        )
        .select_from(ProgramInstance).join(Organization).join(ITDirection).join(ITProduct).join(WorkflowTemplate)
        .outerjoin(User, User.id == ProgramInstance.kam_user_id)
        .outerjoin(WorkflowStageInstance, WorkflowStageInstance.id == ProgramInstance.current_stage_instance_id)
        .outerjoin(WorkflowStage, WorkflowStage.id == WorkflowStageInstance.workflow_stage_id)
        .outerjoin(ProgramMetric, ProgramMetric.program_instance_id == ProgramInstance.id)
        .outerjoin(License, License.program_instance_id == ProgramInstance.id)
    )
    statement = _scope(statement, db, user)
    for column, values in ((ProgramInstance.organization_id, payload.organization_ids), (ProgramInstance.direction_id, payload.direction_ids), (ProgramInstance.product_id, payload.product_ids), (ProgramInstance.kam_user_id, payload.responsible_user_ids), (ProgramInstance.playbook_template_id, payload.playbook_ids), (WorkflowStage.id, payload.stage_ids), (ProgramInstance.health_band, payload.health_bands), (ProgramInstance.status, payload.statuses)):
        if values:
            statement = statement.where(column.in_(values))
    if payload.date_from:
        statement = statement.where(ProgramInstance.started_at >= payload.date_from)
    if payload.date_to:
        statement = statement.where(ProgramInstance.started_at <= payload.date_to)
    sort_columns = {"organization": Organization.name, "direction": ITDirection.name, "product": ITProduct.name, "health": ProgramInstance.health_score, "applications": ProgramMetric.applications_count, "payment_records": ProgramMetric.payment_records_count, "students": ProgramMetric.students_count, "streams": ProgramMetric.streams_count}
    column = sort_columns.get(payload.sort_by, Organization.name)
    return statement.order_by(column.desc() if payload.sort_order == "desc" else column.asc(), ProgramInstance.id)


@router.post("/programs/preview")
def preview_programs(payload: ProgramReportFilter, pagination: PaginationParams = Depends(), db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    statement = _statement(payload, db, current_user)
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = [dict(row) for row in db.execute(statement.limit(pagination.limit).offset(pagination.offset)).mappings().all()]
    aggregates = {key: sum(int(row.get(key) or 0) for row in rows) for key in ("applications", "payment_records", "students", "streams")}
    return {"items": rows, "total": total, "limit": pagination.limit, "offset": pagination.offset, "aggregates": aggregates}


@router.get("/filter-options")
def filter_options(db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    base = _scope(select(ProgramInstance), db, current_user).subquery()
    def options(column, name):
        return [{"id": str(row[0]), "name": row[1]} for row in db.execute(select(column[0], column[1]).join(base, column[0] == base.c[column[2]]).distinct().order_by(column[1])).all()]
    return {
        "organizations": options((Organization.id, Organization.name, "organization_id"), "organizations"),
        "directions": options((ITDirection.id, ITDirection.name, "direction_id"), "directions"),
        "products": options((ITProduct.id, ITProduct.name, "product_id"), "products"),
        "responsibles": options((User.id, User.full_name, "kam_user_id"), "responsibles"),
        "playbooks": options((WorkflowTemplate.id, WorkflowTemplate.name, "playbook_template_id"), "playbooks"),
    }

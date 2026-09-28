from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.common.schemas.pagination import PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES, get_subordinate_kam_ids, has_any_role, is_admin
from app.modules.auth.dependencies import require_roles
from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.documents.model import File
from app.modules.integrations.model import ProgramMetric
from app.modules.licenses.model import License
from app.modules.nba.model import NbaItem
from app.modules.organizations.model import OrgAssignment, Organization
from app.modules.products.model import ITProduct, ProgramProduct
from app.modules.program_instances.model import ProgramInstance
from app.modules.programs.model import ITDirection, ITProgram
from app.modules.users.model import User
from app.modules.workflows.model import WorkflowStage, WorkflowStageInstance, WorkflowTemplate
from app.modules.reports.model import ReportArtifact, ReportJob
from app.modules.reports.queue import enqueue_report_job
from app.storage.factory import get_storage_adapter

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_roles(*CRM_ROLES))])


IMPLEMENTED_STAGE_CODES = {"start_classes", "classes_running", "period_results"}


def _parse_uuid_query(values: list[str] | None, parameter_name: str) -> set[UUID]:
    if not values:
        return set()
    try:
        return {
            UUID(item.strip())
            for value in values
            for item in value.split(",")
            if item.strip()
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"{parameter_name} must contain comma-separated UUID values",
        ) from exc


def _visible_programs_statement(db: Session, current_user: User):
    return _scope(select(ProgramInstance), db, current_user)


def _report_program_rows(db: Session, current_user: User):
    program_mapping = (
        select(
            ProgramProduct.product_id.label("product_id"),
            ITProgram.direction_id.label("direction_id"),
            ITProgram.id.label("program_id"),
            ITProgram.name.label("program_name"),
        )
        .join(ITProgram, ITProgram.id == ProgramProduct.program_id)
        .subquery()
    )
    statement = (
        _visible_programs_statement(db, current_user)
        .join(Organization, Organization.id == ProgramInstance.organization_id)
        .join(ITDirection, ITDirection.id == ProgramInstance.direction_id)
        .join(ITProduct, ITProduct.id == ProgramInstance.product_id)
        .outerjoin(
            program_mapping,
            and_(
                program_mapping.c.product_id == ITProduct.id,
                program_mapping.c.direction_id == ProgramInstance.direction_id,
            ),
        )
        .outerjoin(User, User.id == ProgramInstance.kam_user_id)
        .outerjoin(ProgramMetric, ProgramMetric.program_instance_id == ProgramInstance.id)
        .outerjoin(
            WorkflowStageInstance,
            WorkflowStageInstance.id == ProgramInstance.current_stage_instance_id,
        )
        .outerjoin(WorkflowStage, WorkflowStage.id == WorkflowStageInstance.workflow_stage_id)
        .with_only_columns(
            ProgramInstance,
            Organization.name.label("organization_name"),
            ITDirection.name.label("direction_name"),
            program_mapping.c.program_id,
            program_mapping.c.program_name,
            ITProduct.name.label("product_name"),
            User.full_name.label("kam_name"),
            ProgramMetric.applications_count,
            ProgramMetric.students_count,
            ProgramMetric.streams_count,
            WorkflowStageInstance.id.label("stage_instance_id"),
            WorkflowStageInstance.due_at,
            WorkflowStageInstance.status.label("stage_status"),
            WorkflowStage.name.label("stage_name"),
        )
    )
    return list(db.execute(statement).all())


def _implementation_status(program: ProgramInstance) -> str:
    if program.status == "completed" or program.current_stage_code in IMPLEMENTED_STAGE_CODES:
        return "implemented"
    return "inProgress"


def _program_rating(programs: list[ProgramInstance]) -> int:
    scores = [program.health_score for program in programs if program.health_score is not None]
    if scores:
        return round(sum(scores) / len(scores))
    health_scores = {"green": 100, "yellow": 60, "red": 25}
    return round(sum(health_scores.get(program.health_band, 0) for program in programs) / len(programs)) if programs else 0


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


class ProgramReportExportRequest(BaseModel):
    format: str = Field(pattern="^(XLSX|XLS|PDF)$")
    filter: ProgramReportFilter
    columns: list[str] = Field(default_factory=list)


def _scope(statement, db: Session, user: User):
    if is_admin(user):
        return statement
    kam_ids = get_subordinate_kam_ids(db, user.id) if has_any_role(user, "MANAGER") else {user.id}
    return statement.where(select(OrgAssignment.id).where(OrgAssignment.organization_id == ProgramInstance.organization_id, OrgAssignment.user_id.in_(kam_ids), OrgAssignment.status == "active").exists())


def _statement(payload: ProgramReportFilter, db: Session, user: User):
    license_number = (
        select(func.max(License.license_number))
        .where(License.program_instance_id == ProgramInstance.id)
        .correlate(ProgramInstance)
        .scalar_subquery()
    )
    b2c_rank = func.dense_rank().over(order_by=(
        func.coalesce(ProgramMetric.students_count, 0).desc(),
        func.coalesce(ProgramMetric.applications_count, 0).desc(),
        func.coalesce(ProgramMetric.streams_count, 0).desc(),
    )).label("b2c_rank")
    statement = (
        select(
            ProgramInstance.id.label("id"), Organization.id.label("organization_id"), Organization.name.label("organization"),
            ITDirection.id.label("direction_id"), ITDirection.name.label("direction"), ITProduct.id.label("product_id"), ITProduct.name.label("product"),
            WorkflowTemplate.id.label("playbook_id"), WorkflowTemplate.name.label("playbook"), ProgramInstance.status.label("status"), ProgramInstance.health_band.label("health_band"), ProgramInstance.health_score.label("health_score"),
            User.id.label("responsible_id"), User.full_name.label("responsible"), WorkflowStage.id.label("stage_id"), WorkflowStage.name.label("stage"),
            license_number.label("license_number"), ProgramMetric.applications_count.label("applications"), ProgramMetric.payment_records_count.label("payment_records"), ProgramMetric.students_count.label("students"), ProgramMetric.streams_count.label("streams"), b2c_rank,
        )
        .select_from(ProgramInstance).join(Organization).join(ITDirection).join(ITProduct).join(WorkflowTemplate)
        .outerjoin(User, User.id == ProgramInstance.kam_user_id)
        .outerjoin(WorkflowStageInstance, WorkflowStageInstance.id == ProgramInstance.current_stage_instance_id)
        .outerjoin(WorkflowStage, WorkflowStage.id == WorkflowStageInstance.workflow_stage_id)
        .outerjoin(ProgramMetric, ProgramMetric.program_instance_id == ProgramInstance.id)
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


def _aggregates(statement, db: Session) -> dict[str, int]:
    rows = statement.order_by(None).subquery()
    result = db.execute(select(
        func.coalesce(func.sum(rows.c.applications), 0),
        func.coalesce(func.sum(rows.c.payment_records), 0),
        func.coalesce(func.sum(rows.c.students), 0),
        func.coalesce(func.sum(rows.c.streams), 0),
    )).one()
    return dict(zip(("applications", "payment_records", "students", "streams"), (int(value or 0) for value in result), strict=True))


def _conversion(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 4) if denominator else None


@router.post("/programs/preview")
def preview_programs(payload: ProgramReportFilter, pagination: PaginationParams = Depends(), db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    statement = _statement(payload, db, current_user)
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = [dict(row) for row in db.execute(statement.limit(pagination.limit).offset(pagination.offset)).mappings().all()]
    aggregates = _aggregates(statement, db)
    return {"items": rows, "total": total, "limit": pagination.limit, "offset": pagination.offset, "aggregates": aggregates, "demo_b2c_conversion": {"payment_records_per_application": _conversion(aggregates["payment_records"], aggregates["applications"]), "students_per_payment_record": _conversion(aggregates["students"], aggregates["payment_records"])}}


@router.get("/filter-options")
def filter_options(db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    base = _scope(select(ProgramInstance), db, current_user).subquery()
    def options(identifier, label, base_key):
        return [{"id": str(row[0]), "name": row[1]} for row in db.execute(select(identifier, label).join(base, identifier == base.c[base_key]).distinct().order_by(label)).all()]
    def values(base_key):
        return [row[0] for row in db.execute(select(base.c[base_key]).where(base.c[base_key].is_not(None)).distinct().order_by(base.c[base_key])).all()]
    return {
        "organizations": options(Organization.id, Organization.name, "organization_id"),
        "directions": options(ITDirection.id, ITDirection.name, "direction_id"),
        "products": options(ITProduct.id, ITProduct.name, "product_id"),
        "responsibles": options(User.id, User.full_name, "kam_user_id"),
        "playbooks": options(WorkflowTemplate.id, WorkflowTemplate.name, "playbook_template_id"),
        "stages": [{"id": str(row[0]), "name": row[1]} for row in db.execute(select(WorkflowStage.id, WorkflowStage.name).join(WorkflowStageInstance, WorkflowStageInstance.workflow_stage_id == WorkflowStage.id).join(base, base.c.current_stage_instance_id == WorkflowStageInstance.id).distinct().order_by(WorkflowStage.name)).all()],
        "health_bands": values("health_band"),
        "statuses": values("status"),
    }


@router.get("/managers/filters")
def manager_report_filters(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    managers = {}
    for row in _report_program_rows(db, current_user):
        program = row[0]
        if program.status == "active" and program.kam_user_id and row.kam_name:
            managers[program.kam_user_id] = row.kam_name
    return {
        "managers": [
            {"id": manager_id, "name": name}
            for manager_id, name in sorted(managers.items(), key=lambda item: item[1])
        ]
    }


@router.get("/managers")
def manager_report(
    kam_id: UUID | None = Query(default=None, alias="kamId"),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    rows = [
        row
        for row in _report_program_rows(db, current_user)
        if row[0].status == "active" and row[0].kam_user_id is not None
    ]
    available_manager_ids = {row[0].kam_user_id for row in rows}
    if kam_id is not None and kam_id not in available_manager_ids:
        raise HTTPException(status_code=403, detail="Cannot access this KAM report")
    if kam_id is not None:
        rows = [row for row in rows if row[0].kam_user_id == kam_id]

    reports: dict[UUID, dict] = {}
    program_context: dict[UUID, tuple[UUID, str, str]] = {}
    now = datetime.now(timezone.utc)
    completed_stage_statuses = {"COMPLETED", "DONE", "SKIPPED"}
    for row in rows:
        program = row[0]
        manager_id = program.kam_user_id
        assert manager_id is not None
        report = reports.setdefault(
            manager_id,
            {
                "id": manager_id,
                "kamId": manager_id,
                "kam": row.kam_name or "Не назначен",
                "activePrograms": 0,
                "greenHealth": 0,
                "yellowHealth": 0,
                "redHealth": 0,
                "overdueTasks": 0,
                "attentionTasks": 0,
                "programItems": [],
                "overdueTaskItems": [],
                "attentionTaskItems": [],
            },
        )
        report["activePrograms"] += 1
        report[f"{program.health_band}Health"] += 1
        report["programItems"].append(
            {
                "id": program.id,
                "university": row.organization_name,
                "name": row.program_name or row.product_name,
                "product": row.product_name,
                "health": program.health_band,
            }
        )
        program_context[program.id] = (manager_id, row.organization_name, row.program_name or row.product_name)
        if (
            row.stage_instance_id
            and row.due_at
            and row.due_at < now
            and row.stage_status not in completed_stage_statuses
        ):
            overdue_days = max((now.date() - row.due_at.date()).days, 0)
            report["overdueTasks"] += 1
            report["overdueTaskItems"].append(
                {
                    "id": row.stage_instance_id,
                    "university": row.organization_name,
                    "program": row.program_name or row.product_name,
                    "reason": f"Просрочен этап: {row.stage_name or 'без названия'}",
                    "overdueDays": overdue_days,
                }
            )

    if program_context:
        attention_items = db.scalars(
            select(NbaItem).where(
                NbaItem.status == "active",
                NbaItem.program_instance_id.in_(program_context),
            )
        ).all()
        for item in attention_items:
            if item.program_instance_id is None:
                continue
            manager_id, university, program_name = program_context[item.program_instance_id]
            reports[manager_id]["attentionTasks"] += 1
            reports[manager_id]["attentionTaskItems"].append(
                {
                    "id": item.id,
                    "university": university,
                    "program": program_name,
                    "reason": item.reason,
                }
            )

    for report in reports.values():
        report["programItems"].sort(key=lambda item: (item["university"], item["name"]))
        report["overdueTaskItems"].sort(key=lambda item: (-item["overdueDays"], item["program"]))
        report["attentionTaskItems"].sort(key=lambda item: (item["university"], item["program"]))
    return sorted(reports.values(), key=lambda item: item["kam"])


@router.get("/programs-rating/filters")
def programs_rating_filters(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    universities: dict[UUID, str] = {}
    programs: dict[UUID, str] = {}
    products: dict[UUID, str] = {}
    responsibles: dict[UUID, str] = {}
    for row in _report_program_rows(db, current_user):
        instance = row[0]
        if instance.status != "active":
            continue
        program_id = row.program_id or instance.product_id
        program_name = row.program_name or row.product_name
        universities[instance.organization_id] = row.organization_name
        programs[program_id] = program_name
        products[instance.product_id] = row.product_name
        if instance.kam_user_id and row.kam_name:
            responsibles[instance.kam_user_id] = row.kam_name

    def options(values: dict[UUID, str]) -> list[dict]:
        return [{"id": item_id, "name": name} for item_id, name in sorted(values.items(), key=lambda item: item[1])]

    return {
        "universities": options(universities),
        "programs": options(programs),
        "products": options(products),
        "responsibles": options(responsibles),
    }


@router.get("/programs-rating")
def programs_rating_report(
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    university_ids: list[str] | None = Query(default=None, alias="universityIds"),
    program_ids: list[str] | None = Query(default=None, alias="programIds"),
    product_ids: list[str] | None = Query(default=None, alias="productIds"),
    responsible_ids: list[str] | None = Query(default=None, alias="responsibleIds"),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="from must not be later than to")
    university_filter = _parse_uuid_query(university_ids, "universityIds")
    program_filter = _parse_uuid_query(program_ids, "programIds")
    product_filter = _parse_uuid_query(product_ids, "productIds")
    responsible_filter = _parse_uuid_query(responsible_ids, "responsibleIds")

    grouped: dict[tuple[UUID, UUID], list] = {}
    for row in _report_program_rows(db, current_user):
        instance = row[0]
        program_id = row.program_id or instance.product_id
        if instance.status != "active":
            continue
        if university_filter and instance.organization_id not in university_filter:
            continue
        if program_filter and program_id not in program_filter:
            continue
        if product_filter and instance.product_id not in product_filter:
            continue
        if responsible_filter and instance.kam_user_id not in responsible_filter:
            continue
        started_on = instance.started_at.date() if instance.started_at else None
        if date_from and (started_on is None or started_on < date_from):
            continue
        if date_to and (started_on is None or started_on > date_to):
            continue
        grouped.setdefault((program_id, instance.product_id), []).append(row)

    items = []
    for (program_id, product_id), rows in grouped.items():
        instances = [row[0] for row in rows]
        university_items = [
            {
                "university": {"id": instance.organization_id, "name": row.organization_name},
                "responsible": {"id": instance.kam_user_id, "name": row.kam_name or "Не назначен"},
                "implementationStatus": _implementation_status(instance),
                "applications": int(row.applications_count or 0),
                "students": int(row.students_count or 0),
                "streams": int(row.streams_count or 0),
            }
            for row, instance in zip(rows, instances, strict=True)
        ]
        implemented = sum(item["implementationStatus"] == "implemented" for item in university_items)
        items.append(
            {
                "id": f"{program_id}-{product_id}",
                "programId": program_id,
                "program": rows[0].program_name or rows[0].product_name,
                "productId": product_id,
                "product": rows[0].product_name,
                "universities": len(university_items),
                "implementedUniversities": implemented,
                "implementationShare": round(implemented / len(university_items) * 100) if university_items else 0,
                "applications": sum(item["applications"] for item in university_items),
                "students": sum(item["students"] for item in university_items),
                "streams": sum(item["streams"] for item in university_items),
                "rating": _program_rating(instances),
                "universityItems": sorted(university_items, key=lambda item: item["university"]["name"]),
            }
        )
    items.sort(key=lambda item: (item["program"], item["product"]))
    return {"items": items, "total": len(items)}


def _get_job(job_id: UUID, db: Session, current_user: User) -> ReportJob:
    job = db.get(ReportJob, job_id)
    if job is None or (not is_admin(current_user) and job.created_by != current_user.id):
        raise HTTPException(status_code=404, detail="Report job not found")
    return job


@router.post("/jobs", status_code=202)
def create_program_report_job(
    payload: ProgramReportExportRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    job = ReportJob(
        status="QUEUED",
        format=payload.format,
        filter_snapshot=payload.filter.model_dump(mode="json"),
        columns_snapshot=payload.columns,
        created_by=current_user.id,
        queued_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.flush()
    AuditEventRepository(db).add(AuditEvent(actor_user_id=current_user.id, action="report.job.queued", entity_type="report_job", entity_id=job.id, result="QUEUED", event_metadata={"format": job.format}))
    db.commit()
    db.refresh(job)
    try:
        enqueue_report_job(job.id)
    except Exception as exc:
        job.status = "FAILED"
        job.finished_at = datetime.now(timezone.utc)
        job.error_code = "REPORT_QUEUE_UNAVAILABLE"
        job.error_message = "Не удалось поставить отчёт в очередь."
        db.commit()
        raise HTTPException(status_code=503, detail=job.error_message) from exc
    return {"id": job.id, "status": job.status}


@router.get("/jobs")
def list_report_jobs(
    include_all: bool = False,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    if include_all and not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Only ADMIN can view all report jobs")
    statement = select(ReportJob)
    if not include_all:
        statement = statement.where(ReportJob.created_by == current_user.id)
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    jobs = list(db.scalars(statement.order_by(ReportJob.created_at.desc()).limit(pagination.limit).offset(pagination.offset)).all())
    artifacts = {artifact.report_job_id: artifact for artifact in db.scalars(select(ReportArtifact).where(ReportArtifact.report_job_id.in_([job.id for job in jobs])).order_by(ReportArtifact.created_at.desc())).all()} if jobs else {}
    return {"items": [{"id": job.id, "status": job.status, "format": job.format, "created_at": job.created_at, "finished_at": job.finished_at, "row_count": job.row_count, "error_code": job.error_code, "error_message": job.error_message, "ready": job.id in artifacts, "download_path": f"/api/reports/jobs/{job.id}/download" if job.id in artifacts else None} for job in jobs], "total": total, "limit": pagination.limit, "offset": pagination.offset}


@router.get("/jobs/{job_id}")
def get_report_job(job_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    job = _get_job(job_id, db, current_user)
    artifact = db.scalar(select(ReportArtifact).where(ReportArtifact.report_job_id == job.id).order_by(ReportArtifact.created_at.desc()))
    return {"id": job.id, "status": job.status, "format": job.format, "created_at": job.created_at, "finished_at": job.finished_at, "row_count": job.row_count, "error_code": job.error_code, "error_message": job.error_message, "ready": artifact is not None, "download_path": f"/api/reports/jobs/{job.id}/download" if artifact else None}


@router.get("/jobs/{job_id}/download")
def download_report_job(job_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    job = _get_job(job_id, db, current_user)
    artifact = db.scalar(select(ReportArtifact).where(ReportArtifact.report_job_id == job.id).order_by(ReportArtifact.created_at.desc()))
    if artifact is None:
        raise HTTPException(status_code=409, detail="Report is not ready")
    file = db.get(File, artifact.file_id)
    if file is None or not file.bucket or not file.object_key:
        raise HTTPException(status_code=404, detail="Report artifact not found")
    stream = get_storage_adapter().get_stream(bucket=file.bucket, object_key=file.object_key)
    try:
        content = stream.read()
    finally:
        stream.close()
    filename = file.original_name.replace('"', "")
    return Response(content=content, media_type=file.mime_type or "application/octet-stream", headers={"Content-Disposition": f'attachment; filename="{filename}"'})

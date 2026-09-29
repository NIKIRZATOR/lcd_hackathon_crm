from uuid import UUID

from pathlib import Path
from tempfile import NamedTemporaryFile

import secrets

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db_session
from app.modules.auth.access import ADMIN_ROLES, CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.integrations.model import IntegrationSignal
from app.modules.integrations.schemas import (
    CourseMappingCreate,
    FixtureProcessRead,
    IntegrationPackageRead,
    LmsEventCreate,
    LmsSendResultRead,
    MappingApplyRequest,
    ProgramMetricRead,
    ReplayRequest,
    StreamMappingCreate,
    SyncResultRead,
)
from app.modules.integrations.service import IntegrationSyncService
from app.modules.organizations.model import Organization
from app.modules.products.model import ITProduct
from app.modules.program_instances.model import ProgramInstance
from app.modules.program_instances.service import ProgramInstanceService
from app.modules.users.model import User

router = APIRouter(
    prefix="/integrations",
    tags=["integrations"],
    dependencies=[Depends(require_roles(*CRM_ROLES))],
)
lms_router = APIRouter(prefix="/integrations/lms", tags=["integrations"])


def require_lms_service_token(
    x_lms_service_token: str | None = Header(default=None),
) -> None:
    if not settings.lms_service_token or not x_lms_service_token or not secrets.compare_digest(
        x_lms_service_token, settings.lms_service_token
    ):
        raise HTTPException(status_code=401, detail="Invalid LMS service token")


@router.get(
    "/program-instances/{program_instance_id}/metrics",
    response_model=ProgramMetricRead | None,
)
def get_metrics(
    program_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    ProgramInstanceService(db).get(program_instance_id, current_user)
    return IntegrationSyncService(db).metrics(program_instance_id)


@router.post(
    "/program-instances/{program_instance_id}/sync", response_model=SyncResultRead
)
def sync_program(
    program_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    ProgramInstanceService(db).get(program_instance_id, current_user)
    return IntegrationSyncService(db).sync_program(program_instance_id)


@router.post(
    "/program-instances/{program_instance_id}/lms/send",
    response_model=LmsSendResultRead,
)
def send_program_to_lms(
    program_instance_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
):
    ProgramInstanceService(db).get(program_instance_id, current_user)
    try:
        return IntegrationSyncService(db).send_program_to_lms(program_instance_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@lms_router.post("/events", dependencies=[Depends(require_lms_service_token)])
def receive_lms_event(
    payload: LmsEventCreate,
    db: Session = Depends(get_db_session),
):
    return IntegrationSyncService(db).receive_lms_event(payload)


@router.get("/sources", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def sources(db: Session = Depends(get_db_session)):
    return IntegrationSyncService(db).sources_summary()


@router.get("/diagnostics", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def diagnostics(db: Session = Depends(get_db_session)):
    return IntegrationSyncService(db).diagnostics()


@router.get("/packages", response_model=list[IntegrationPackageRead], dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def packages(db: Session = Depends(get_db_session)):
    return IntegrationSyncService(db).packages()


@router.post(
    "/sources/{source}/process",
    response_model=FixtureProcessRead,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def process_source(
    source: str,
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    temp_path: Path | None = None
    try:
        if file is not None:
            suffix = Path(file.filename or "").suffix
            with NamedTemporaryFile(delete=False, suffix=suffix) as temp:
                while chunk := file.file.read(1024 * 1024):
                    temp.write(chunk)
                temp_path = Path(temp.name)
        return IntegrationSyncService(db).process_fixture(
            source.upper(),
            current_user.id,
            temp_path,
            file.filename if file is not None else "TEAM DEMO fixture",
        )
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


@router.get("/signals", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def signals(
    db: Session = Depends(get_db_session),
    source: str | None = None,
    status: str | None = None,
):
    statement = (
        select(IntegrationSignal)
        .order_by(IntegrationSignal.received_at.desc())
        .limit(500)
    )
    if source:
        statement = statement.where(IntegrationSignal.source == source.upper())
    if status:
        statement = statement.where(IntegrationSignal.status == status)
    result = []
    for item in db.scalars(statement):
        program = db.get(ProgramInstance, item.program_instance_id) if item.program_instance_id else None
        organization = db.get(Organization, item.organization_id) if item.organization_id else None
        product = db.get(ITProduct, program.product_id) if program else None
        result.append({
            "id": str(item.id),
            "source": item.source,
            "external_key": item.external_key,
            "status": item.status,
            "received_at": item.received_at,
            "normalized_payload": item.normalized_payload,
            "program_instance_id": item.program_instance_id,
            "error_code": item.error_code,
            "error_message": item.error_message,
            "match_reason": item.match_reason,
            "organization_name": organization.name if organization else None,
            "program_name": f"{organization.name} · {product.name}" if organization and product else None,
        })
    return result


@router.get(
    "/signals/{signal_id}/raw", dependencies=[Depends(require_roles(*ADMIN_ROLES))]
)
def raw_signal(
    signal_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    signal = db.get(IntegrationSignal, signal_id)
    if signal is None:
        raise HTTPException(status_code=404, detail="Integration signal not found")
    return {"id": str(signal.id), "raw_payload": signal.payload}


@router.post("/mappings/courses", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def create_course_mapping(
    payload: CourseMappingCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return IntegrationSyncService(db).create_course_mapping(
        source=payload.source.upper(),
        course=payload.external_course_name,
        direction_id=payload.direction_id,
        product_id=payload.product_id,
        actor_user_id=current_user.id,
    )


@router.post("/mappings/streams", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def create_stream_mapping(
    payload: StreamMappingCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return IntegrationSyncService(db).create_stream_mapping(
        source=payload.source.upper(),
        course=payload.external_course_name,
        stream=payload.external_stream_id,
        program_id=payload.program_instance_id,
        actor_user_id=current_user.id,
    )


@router.post("/mappings/apply", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def apply_mapping(
    payload: MappingApplyRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return IntegrationSyncService(db).apply_mapping_and_replay(
        source=payload.source.upper(),
        course=payload.external_course_name,
        stream=payload.external_stream_id,
        program_id=payload.program_instance_id,
        actor_user_id=current_user.id,
    )


@router.post("/replay", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def replay(
    payload: ReplayRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return IntegrationSyncService(db).replay(
        payload.source.upper(),
        payload.external_course_name,
        payload.external_stream_id,
        current_user.id,
    )

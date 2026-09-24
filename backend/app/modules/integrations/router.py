from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.integrations.schemas import ProgramMetricRead, SyncResultRead
from app.modules.integrations.service import IntegrationSyncService
from app.modules.program_instances.service import ProgramInstanceService
from app.modules.users.model import User

router = APIRouter(prefix="/integrations", tags=["integrations"], dependencies=[Depends(require_roles(*CRM_ROLES))])


@router.get("/program-instances/{program_instance_id}/metrics", response_model=ProgramMetricRead | None)
def get_metrics(program_instance_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    ProgramInstanceService(db).get(program_instance_id, current_user)
    return IntegrationSyncService(db).metrics(program_instance_id)


@router.post("/program-instances/{program_instance_id}/sync", response_model=SyncResultRead)
def sync_program(program_instance_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    ProgramInstanceService(db).get(program_instance_id, current_user)
    return IntegrationSyncService(db).sync_program(program_instance_id)

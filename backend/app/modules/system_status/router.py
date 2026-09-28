from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.modules.auth.access import ADMIN_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.system_status.service import PlatformStatusService

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/status")
def system_status(
    db: Session = Depends(get_db_session),
    _=Depends(require_roles(*ADMIN_ROLES)),
):
    return PlatformStatusService(db).summary()

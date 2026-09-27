from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import ADMIN_ROLES, CATALOG_WRITE_ROLES, CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.organizations.model import OrganizationType
from app.modules.organizations.schemas import AssignmentCreate, AssignmentHistoryRead, AssignmentRead, KamRead, Organization360Read, OrganizationCreate, OrganizationDocumentRead, OrganizationFeedItemRead, OrganizationListRead, OrganizationRead, OrganizationTypeRead, OrganizationUpdate, StakeholderCreate, StakeholderRead, StakeholderUpdate
from app.modules.organizations.service import OrganizationService
from app.modules.users.model import User

router = APIRouter(prefix="/organizations", tags=["organizations"], dependencies=[Depends(require_roles(*CRM_ROLES))])

@router.get("/types", response_model=list[OrganizationTypeRead])
def list_types(db: Session = Depends(get_db_session)):
    return list(db.scalars(select(OrganizationType).where(OrganizationType.is_active.is_(True)).order_by(OrganizationType.name)).all())

@router.get("", response_model=Page[OrganizationListRead])
def list_organizations(search: str | None = None, unassigned_only: bool = False, pagination: PaginationParams = Depends(), db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    result = OrganizationService(db).list(current_user, search, pagination.limit, pagination.offset, unassigned_only)
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)

@router.post("", response_model=OrganizationRead, status_code=201)
def create_organization(payload: OrganizationCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*ADMIN_ROLES))):
    return OrganizationService(db).create(payload, current_user)

@router.get("/{organization_id}", response_model=OrganizationRead)
def get_organization(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return OrganizationService(db).get(organization_id, current_user)

@router.get("/{organization_id}/360", response_model=Organization360Read)
def get_organization_360(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return OrganizationService(db).summary_360(organization_id, current_user)

@router.get("/{organization_id}/documents", response_model=list[OrganizationDocumentRead])
def list_organization_documents(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return OrganizationService(db).documents(organization_id, current_user)

@router.get("/{organization_id}/feed", response_model=list[OrganizationFeedItemRead])
def list_organization_feed(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return OrganizationService(db).feed(organization_id, current_user)

@router.get("/{organization_id}/eligible-kams", response_model=list[KamRead])
def list_eligible_kams(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return OrganizationService(db).eligible_kams(organization_id, current_user)

@router.patch("/{organization_id}", response_model=OrganizationRead)
def update_organization(organization_id: UUID, payload: OrganizationUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES))):
    return OrganizationService(db).update(organization_id, payload, current_user)

@router.post("/{organization_id}/assignments", response_model=AssignmentRead, status_code=201)
def assign_kam(organization_id: UUID, payload: AssignmentCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES))):
    return OrganizationService(db).assign(organization_id, payload, current_user)

@router.get("/{organization_id}/assignments", response_model=list[AssignmentHistoryRead])
def list_assignment_history(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES))):
    return OrganizationService(db).assignment_history(organization_id, current_user)

@router.get("/{organization_id}/stakeholders", response_model=list[StakeholderRead])
def list_stakeholders(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return OrganizationService(db).stakeholders(organization_id, current_user)

@router.post("/{organization_id}/stakeholders", response_model=StakeholderRead, status_code=201)
def add_stakeholder(organization_id: UUID, payload: StakeholderCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return OrganizationService(db).add_stakeholder(organization_id, payload, current_user)

@router.patch("/stakeholders/{stakeholder_id}", response_model=StakeholderRead)
def update_stakeholder(stakeholder_id: UUID, payload: StakeholderUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return OrganizationService(db).update_stakeholder(stakeholder_id, payload, current_user)

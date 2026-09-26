from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.licenses.schemas import ContractCreate, ContractRead, ContractUpdate, LicenseCreate, LicenseRead, LicenseUpdate
from app.modules.licenses.service import ContractLicenseService
from app.modules.users.model import User

router = APIRouter(tags=["contracts_and_licenses"], dependencies=[Depends(require_roles(*CRM_ROLES))])


def license_read(row) -> LicenseRead:
    license_record, product_name = row
    return LicenseRead.model_validate({**{field: getattr(license_record, field) for field in LicenseRead.model_fields if field not in {"id", "product_name"}}, "id": license_record.id, "product_name": product_name})


@router.get("/organizations/{organization_id}/contracts", response_model=list[ContractRead])
def list_contracts(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return ContractLicenseService(db).contracts(organization_id, current_user)


@router.post("/organizations/{organization_id}/contracts", response_model=ContractRead, status_code=201)
def create_contract(organization_id: UUID, payload: ContractCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return ContractLicenseService(db).create_contract(organization_id, payload, current_user)


@router.patch("/contracts/{contract_id}", response_model=ContractRead)
def update_contract(contract_id: UUID, payload: ContractUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return ContractLicenseService(db).update_contract(contract_id, payload, current_user)


@router.get("/organizations/{organization_id}/licenses", response_model=list[LicenseRead])
def list_licenses(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return [license_read(row) for row in ContractLicenseService(db).licenses(organization_id, current_user)]


@router.post("/organizations/{organization_id}/licenses", response_model=LicenseRead, status_code=201)
def create_license(organization_id: UUID, payload: LicenseCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return license_read(ContractLicenseService(db).create_license(organization_id, payload, current_user))


@router.patch("/licenses/{license_id}", response_model=LicenseRead)
def update_license(license_id: UUID, payload: LicenseUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return license_read(ContractLicenseService(db).update_license(license_id, payload, current_user))


@router.get("/program-instances/{program_instance_id}/license", response_model=LicenseRead | None)
def program_license(program_instance_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    row = ContractLicenseService(db).program_license(program_instance_id, current_user)
    return license_read(row) if row else None

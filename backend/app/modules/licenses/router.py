from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.licenses.schemas import ContractCreate, ContractRead, ContractUpdate, LicenseCreate, LicenseRead, LicenseUpdate
from app.modules.licenses.service import ContractLicenseService
from app.modules.users.model import User
from app.common.errors import get_request_id
from app.modules.documents.file_service import FileService
from app.modules.documents.model import File

router = APIRouter(tags=["contracts_and_licenses"], dependencies=[Depends(require_roles(*CRM_ROLES))])


def _attachment_fields(db: Session, attachment_id: UUID | None, download_url: str) -> dict:
    file_record = db.get(File, attachment_id) if attachment_id is not None else None
    return {
        "attachment_name": file_record.original_name if file_record is not None else None,
        "attachment_download_url": download_url if file_record is not None else None,
    }


def contract_read(db: Session, contract) -> ContractRead:
    values = {field: getattr(contract, field) for field in ContractRead.model_fields if hasattr(contract, field)}
    values.update(_attachment_fields(db, contract.attachment_id, f"/api/contracts/{contract.id}/attachment/download"))
    return ContractRead.model_validate(values)


def license_read(db: Session, row) -> LicenseRead:
    license_record, product_name = row
    values = {field: getattr(license_record, field) for field in LicenseRead.model_fields if hasattr(license_record, field)}
    values.update({"id": license_record.id, "product_name": product_name})
    values.update(_attachment_fields(db, license_record.attachment_id, f"/api/licenses/{license_record.id}/attachment/download"))
    return LicenseRead.model_validate(values)


@router.get("/organizations/{organization_id}/contracts", response_model=list[ContractRead])
def list_contracts(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return [contract_read(db, item) for item in ContractLicenseService(db).contracts(organization_id, current_user)]


@router.post("/organizations/{organization_id}/contracts", response_model=ContractRead, status_code=201)
def create_contract(organization_id: UUID, payload: ContractCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return contract_read(db, ContractLicenseService(db).create_contract(organization_id, payload, current_user))


@router.patch("/contracts/{contract_id}", response_model=ContractRead)
def update_contract(contract_id: UUID, payload: ContractUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return contract_read(db, ContractLicenseService(db).update_contract(contract_id, payload, current_user))


@router.get("/organizations/{organization_id}/licenses", response_model=list[LicenseRead])
def list_licenses(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return [license_read(db, row) for row in ContractLicenseService(db).licenses(organization_id, current_user)]


@router.post("/organizations/{organization_id}/licenses", response_model=LicenseRead, status_code=201)
def create_license(organization_id: UUID, payload: LicenseCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return license_read(db, ContractLicenseService(db).create_license(organization_id, payload, current_user))


@router.patch("/licenses/{license_id}", response_model=LicenseRead)
def update_license(license_id: UUID, payload: LicenseUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return license_read(db, ContractLicenseService(db).update_license(license_id, payload, current_user))


@router.get("/program-instances/{program_instance_id}/license", response_model=LicenseRead | None)
def program_license(program_instance_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    row = ContractLicenseService(db).program_license(program_instance_id, current_user)
    return license_read(db, row) if row else None


def _download_attachment(file_id: UUID | None, request: Request, db: Session, current_user: User):
    if file_id is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    service = FileService(db)
    file_record = service.get_file(file_id)
    download_name = file_record.original_name.replace('"', "").replace("\r", "").replace("\n", "")
    return StreamingResponse(
        service.stream_file(file_record=file_record, actor_user_id=current_user.id, request_id=get_request_id(request)),
        media_type=file_record.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
    )


@router.get("/contracts/{contract_id}/attachment/download")
def download_contract_attachment(contract_id: UUID, request: Request, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    contract = ContractLicenseService(db).contract(contract_id, current_user)
    return _download_attachment(contract.attachment_id, request, db, current_user)


@router.get("/licenses/{license_id}/attachment/download")
def download_license_attachment(license_id: UUID, request: Request, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    license_record = ContractLicenseService(db).license(license_id, current_user)
    return _download_attachment(license_record.attachment_id, request, db, current_user)

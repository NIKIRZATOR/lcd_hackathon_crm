from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.health.service import HealthService
from app.modules.nba.service import NbaService
from app.modules.licenses.model import Contract, License
from app.modules.licenses.schemas import ContractCreate, ContractUpdate, LicenseCreate, LicenseUpdate
from app.modules.documents.model import File
from app.modules.organizations.model import Stakeholder
from app.modules.organizations.service import OrganizationService
from app.modules.products.model import ITProduct
from app.modules.program_instances.model import ProgramInstance
from app.modules.users.model import User


class ContractLicenseService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def contracts(self, organization_id: UUID, user: User) -> list[Contract]:
        OrganizationService(self.db).get(organization_id, user)
        return list(self.db.scalars(select(Contract).where(Contract.organization_id == organization_id).order_by(Contract.created_at.desc())).all())

    def create_contract(self, organization_id: UUID, payload: ContractCreate, user: User) -> Contract:
        OrganizationService(self.db).get(organization_id, user)
        self._validate_attachment(payload.attachment_id)
        contract = Contract(organization_id=organization_id, **payload.model_dump())
        self.db.add(contract)
        self.db.commit()
        self.db.refresh(contract)
        return contract

    def update_contract(self, contract_id: UUID, payload: ContractUpdate, user: User) -> Contract:
        contract = self.db.get(Contract, contract_id)
        if contract is None or contract.organization_id is None:
            raise HTTPException(status_code=404, detail="Contract not found")
        OrganizationService(self.db).get(contract.organization_id, user)
        if "attachment_id" in payload.model_fields_set:
            self._validate_attachment(payload.attachment_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(contract, field, value)
        self.db.commit()
        self.db.refresh(contract)
        return contract

    def licenses(self, organization_id: UUID, user: User):
        OrganizationService(self.db).get(organization_id, user)
        return self.db.execute(
            select(License, ITProduct.name.label("product_name"))
            .join(ProgramInstance, ProgramInstance.id == License.program_instance_id)
            .join(ITProduct, ITProduct.id == License.product_id)
            .where(ProgramInstance.organization_id == organization_id)
            .order_by(ITProduct.name)
        ).all()

    def create_license(self, organization_id: UUID, payload: LicenseCreate, user: User):
        program = self._program(organization_id, payload.program_instance_id, user)
        if payload.contract_id is not None:
            contract = self.db.get(Contract, payload.contract_id)
            if contract is None or contract.organization_id != organization_id:
                raise HTTPException(status_code=422, detail="Contract does not belong to organization")
        self._validate_attachment(payload.attachment_id)
        self._validate_recipient(payload.recipient_stakeholder_id, organization_id)
        license_record = License(product_id=program.product_id, **payload.model_dump())
        self.db.add(license_record)
        self.db.flush()
        HealthService(self.db).recompute(program.id)
        NbaService(self.db).recompute_program(program.id)
        self.db.commit()
        self.db.refresh(license_record)
        return license_record, self.db.scalar(select(ITProduct.name).where(ITProduct.id == license_record.product_id))

    def update_license(self, license_id: UUID, payload: LicenseUpdate, user: User):
        license_record = self.db.get(License, license_id)
        if license_record is None or license_record.program_instance_id is None:
            raise HTTPException(status_code=404, detail="License not found")
        program = self.db.get(ProgramInstance, license_record.program_instance_id)
        assert program is not None
        OrganizationService(self.db).get(program.organization_id, user)
        if payload.contract_id is not None:
            contract = self.db.get(Contract, payload.contract_id)
            if contract is None or contract.organization_id != program.organization_id:
                raise HTTPException(status_code=422, detail="Contract does not belong to organization")
        if "attachment_id" in payload.model_fields_set:
            self._validate_attachment(payload.attachment_id)
        if "recipient_stakeholder_id" in payload.model_fields_set:
            self._validate_recipient(payload.recipient_stakeholder_id, program.organization_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(license_record, field, value)
        self.db.flush()
        HealthService(self.db).recompute(program.id)
        NbaService(self.db).recompute_program(program.id)
        self.db.commit()
        self.db.refresh(license_record)
        return license_record, self.db.scalar(select(ITProduct.name).where(ITProduct.id == license_record.product_id))

    def program_license(self, program_instance_id: UUID, user: User):
        program = self.db.get(ProgramInstance, program_instance_id)
        if program is None:
            raise HTTPException(status_code=404, detail="Program instance not found")
        OrganizationService(self.db).get(program.organization_id, user)
        return self.db.execute(select(License, ITProduct.name.label("product_name")).join(ITProduct).where(License.program_instance_id == program_instance_id)).first()

    def _program(self, organization_id: UUID, program_instance_id: UUID, user: User) -> ProgramInstance:
        OrganizationService(self.db).get(organization_id, user)
        program = self.db.get(ProgramInstance, program_instance_id)
        if program is None or program.organization_id != organization_id:
            raise HTTPException(status_code=422, detail="Program does not belong to organization")
        return program

    def contract(self, contract_id: UUID, user: User) -> Contract:
        contract = self.db.get(Contract, contract_id)
        if contract is None or contract.organization_id is None:
            raise HTTPException(status_code=404, detail="Contract not found")
        OrganizationService(self.db).get(contract.organization_id, user)
        return contract

    def license(self, license_id: UUID, user: User) -> License:
        license_record = self.db.get(License, license_id)
        if license_record is None or license_record.program_instance_id is None:
            raise HTTPException(status_code=404, detail="License not found")
        program = self.db.get(ProgramInstance, license_record.program_instance_id)
        if program is None:
            raise HTTPException(status_code=404, detail="Program instance not found")
        OrganizationService(self.db).get(program.organization_id, user)
        return license_record

    def _validate_attachment(self, file_id: UUID | None) -> None:
        if file_id is not None and self.db.get(File, file_id) is None:
            raise HTTPException(status_code=422, detail="Attachment file not found")

    def _validate_recipient(self, stakeholder_id: UUID | None, organization_id: UUID) -> None:
        if stakeholder_id is None:
            return
        stakeholder = self.db.get(Stakeholder, stakeholder_id)
        if stakeholder is None or stakeholder.organization_id != organization_id:
            raise HTTPException(status_code=422, detail="Recipient does not belong to organization")

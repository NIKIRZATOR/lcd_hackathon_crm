from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.health.service import HealthService
from app.modules.nba.service import NbaService
from app.modules.organizations.model import Stakeholder
from app.modules.organizations.service import OrganizationService
from app.modules.products.model import ITProduct
from app.modules.program_instances.model import ProgramInstance
from app.modules.teachers.model import TeacherCarrier
from app.modules.teachers.schemas import TeacherCarrierCreate, TeacherCarrierUpdate
from app.modules.users.model import User


class TeacherCarrierService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, organization_id: UUID, user: User):
        OrganizationService(self.db).get(organization_id, user)
        return self.db.execute(select(TeacherCarrier, ITProduct.name.label("product_name")).join(ITProduct).where(TeacherCarrier.organization_id == organization_id).order_by(TeacherCarrier.full_name)).all()

    def create(self, organization_id: UUID, payload: TeacherCarrierCreate, user: User) -> TeacherCarrier:
        OrganizationService(self.db).get(organization_id, user)
        self._validate_links(organization_id, payload.product_id, payload.program_instance_id, payload.stakeholder_id)
        carrier = TeacherCarrier(organization_id=organization_id, **payload.model_dump())
        self.db.add(carrier)
        self.db.commit()
        if carrier.program_instance_id is not None:
            HealthService(self.db).recompute(carrier.program_instance_id)
            NbaService(self.db).recompute_program(carrier.program_instance_id)
        self.db.refresh(carrier)
        return carrier

    def update(self, carrier_id: UUID, payload: TeacherCarrierUpdate, user: User) -> TeacherCarrier:
        carrier = self.db.get(TeacherCarrier, carrier_id)
        if carrier is None:
            raise HTTPException(status_code=404, detail="Teacher carrier not found")
        OrganizationService(self.db).get(carrier.organization_id, user)
        previous_program_instance_id = carrier.program_instance_id
        values = payload.model_dump(exclude_unset=True)
        self._validate_links(
            carrier.organization_id,
            values.get("product_id", carrier.product_id),
            values.get("program_instance_id", carrier.program_instance_id),
            values.get("stakeholder_id", carrier.stakeholder_id),
        )
        for field, value in values.items():
            setattr(carrier, field, value)
        self.db.commit()
        if carrier.program_instance_id is not None:
            HealthService(self.db).recompute(carrier.program_instance_id)
            NbaService(self.db).recompute_program(carrier.program_instance_id)
        if (
            previous_program_instance_id is not None
            and previous_program_instance_id != carrier.program_instance_id
        ):
            HealthService(self.db).recompute(previous_program_instance_id)
        self.db.refresh(carrier)
        return carrier

    def program_carriers(self, program_instance_id: UUID, user: User):
        program = self.db.get(ProgramInstance, program_instance_id)
        if program is None:
            raise HTTPException(status_code=404, detail="Program instance not found")
        OrganizationService(self.db).get(program.organization_id, user)
        return self.db.execute(select(TeacherCarrier, ITProduct.name.label("product_name")).join(ITProduct).where(TeacherCarrier.program_instance_id == program_instance_id)).all()

    def _validate_links(self, organization_id: UUID, product_id: UUID, program_instance_id: UUID | None, stakeholder_id: UUID | None) -> None:
        if self.db.get(ITProduct, product_id) is None:
            raise HTTPException(status_code=422, detail="Product not found")
        if program_instance_id is not None:
            program = self.db.get(ProgramInstance, program_instance_id)
            if program is None or program.organization_id != organization_id:
                raise HTTPException(status_code=422, detail="Program does not belong to organization")
        if stakeholder_id is not None:
            stakeholder = self.db.get(Stakeholder, stakeholder_id)
            if stakeholder is None or stakeholder.organization_id != organization_id:
                raise HTTPException(status_code=422, detail="Stakeholder does not belong to organization")

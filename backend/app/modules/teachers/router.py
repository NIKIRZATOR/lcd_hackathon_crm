from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.products.model import ITProduct
from app.modules.teachers.schemas import TeacherCarrierCreate, TeacherCarrierRead, TeacherCarrierUpdate
from app.modules.teachers.service import TeacherCarrierService
from app.modules.users.model import User

router = APIRouter(tags=["teachers"], dependencies=[Depends(require_roles(*CRM_ROLES))])


def teacher_read(row) -> TeacherCarrierRead:
    carrier, product_name = row
    return TeacherCarrierRead.model_validate({**{field: getattr(carrier, field) for field in TeacherCarrierRead.model_fields if field not in {"id", "product_name"}}, "id": carrier.id, "product_name": product_name})


@router.get("/organizations/{organization_id}/teachers", response_model=list[TeacherCarrierRead])
def list_teachers(organization_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return [teacher_read(row) for row in TeacherCarrierService(db).list(organization_id, current_user)]


@router.post("/organizations/{organization_id}/teachers", response_model=TeacherCarrierRead, status_code=201)
def create_teacher(organization_id: UUID, payload: TeacherCarrierCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    service = TeacherCarrierService(db)
    carrier = service.create(organization_id, payload, current_user)
    return teacher_read((carrier, db.scalar(select(ITProduct.name).where(ITProduct.id == carrier.product_id))))


@router.patch("/teachers/{carrier_id}", response_model=TeacherCarrierRead)
def update_teacher(carrier_id: UUID, payload: TeacherCarrierUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    service = TeacherCarrierService(db)
    carrier = service.update(carrier_id, payload, current_user)
    return teacher_read((carrier, db.scalar(select(ITProduct.name).where(ITProduct.id == carrier.product_id))))


@router.get("/program-instances/{program_instance_id}/teachers", response_model=list[TeacherCarrierRead])
def program_teachers(program_instance_id: UUID, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CRM_ROLES))):
    return [teacher_read(row) for row in TeacherCarrierService(db).program_carriers(program_instance_id, current_user)]

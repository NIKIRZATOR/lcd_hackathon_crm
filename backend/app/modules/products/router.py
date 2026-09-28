from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.schemas.pagination import Page, PaginationParams
from app.core.database import get_db_session
from app.modules.auth.access import CATALOG_WRITE_ROLES, CRM_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.products.schemas import (
    ITProductCreate,
    ITProductRead,
    ITProductUpdate,
    ProgramProductCreate,
    ProgramProductRead,
    ProgramProductUpdate,
    VendorCreate,
    VendorContactCreate,
    VendorContactRead,
    VendorContactUpdate,
    VendorRead,
    VendorUpdate,
)
from app.modules.products.service import ITProductService, ProgramProductService, VendorService
from app.modules.products.model import Vendor, VendorContact
from app.modules.users.model import User

router = APIRouter(tags=["products"], dependencies=[Depends(require_roles(*CRM_ROLES))])


@router.get("/vendors", response_model=Page[VendorRead])
def list_vendors(
    search: str | None = None,
    is_active: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = VendorService(db).list_vendors(
        search=search,
        is_active=is_active,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/vendors/{vendor_id}", response_model=VendorRead)
def get_vendor(vendor_id: UUID, db: Session = Depends(get_db_session)):
    return VendorService(db).get_vendor(vendor_id)


@router.post("/vendors", response_model=VendorRead, status_code=201)
def create_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return VendorService(db).create_vendor(payload)


@router.patch("/vendors/{vendor_id}", response_model=VendorRead)
def update_vendor(
    vendor_id: UUID,
    payload: VendorUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return VendorService(db).update_vendor(vendor_id, payload)


@router.patch("/vendors/{vendor_id}/deactivate", response_model=VendorRead)
def deactivate_vendor(
    vendor_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return VendorService(db).deactivate_vendor(vendor_id)


@router.get("/vendors/{vendor_id}/contacts", response_model=list[VendorContactRead])
def list_vendor_contacts(vendor_id: UUID, db: Session = Depends(get_db_session)):
    if db.get(Vendor, vendor_id) is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return list(db.scalars(select(VendorContact).where(VendorContact.vendor_id == vendor_id).order_by(VendorContact.full_name)).all())


@router.post("/vendors/{vendor_id}/contacts", response_model=VendorContactRead, status_code=201)
def create_vendor_contact(vendor_id: UUID, payload: VendorContactCreate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES))):
    if db.get(Vendor, vendor_id) is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if db.scalar(select(VendorContact.id).where(VendorContact.vendor_id == vendor_id, VendorContact.business_key == payload.business_key)):
        raise HTTPException(status_code=409, detail="Vendor contact business key already exists")
    contact = VendorContact(vendor_id=vendor_id, **payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.patch("/vendor-contacts/{contact_id}", response_model=VendorContactRead)
def update_vendor_contact(contact_id: UUID, payload: VendorContactUpdate, db: Session = Depends(get_db_session), current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES))):
    contact = db.get(VendorContact, contact_id)
    if contact is None:
        raise HTTPException(status_code=404, detail="Vendor contact not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact


@router.get("/it-products", response_model=Page[ITProductRead])
def list_products(
    search: str | None = None,
    vendor_id: UUID | None = None,
    is_active: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = ITProductService(db).list_products(
        search=search,
        vendor_id=vendor_id,
        is_active=is_active,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/it-products/{product_id}", response_model=ITProductRead)
def get_product(product_id: UUID, db: Session = Depends(get_db_session)):
    return ITProductService(db).get_product(product_id)


@router.post("/it-products", response_model=ITProductRead, status_code=201)
def create_product(
    payload: ITProductCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return ITProductService(db).create_product(payload)


@router.patch("/it-products/{product_id}", response_model=ITProductRead)
def update_product(
    product_id: UUID,
    payload: ITProductUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return ITProductService(db).update_product(product_id, payload)


@router.patch("/it-products/{product_id}/deactivate", response_model=ITProductRead)
def deactivate_product(
    product_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return ITProductService(db).deactivate_product(product_id)


@router.get("/program-products", response_model=Page[ProgramProductRead])
def list_program_product_links(
    program_id: UUID | None = None,
    product_id: UUID | None = None,
    is_required: bool | None = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db_session),
):
    result = ProgramProductService(db).list_links(
        program_id=program_id,
        product_id=product_id,
        is_required=is_required,
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by=pagination.sort_by,
        sort_order=pagination.sort_order,
    )
    return Page(items=result.items, total=result.total, limit=pagination.limit, offset=pagination.offset)


@router.get("/program-products/{link_id}", response_model=ProgramProductRead)
def get_program_product_link(link_id: UUID, db: Session = Depends(get_db_session)):
    return ProgramProductService(db).get_link(link_id)


@router.post("/program-products", response_model=ProgramProductRead, status_code=201)
def create_program_product_link(
    payload: ProgramProductCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return ProgramProductService(db).create_link(payload)


@router.patch("/program-products/{link_id}", response_model=ProgramProductRead)
def update_program_product_link(
    link_id: UUID,
    payload: ProgramProductUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    return ProgramProductService(db).update_link(link_id, payload)


@router.delete("/program-products/{link_id}", status_code=204)
def delete_program_product_link(
    link_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    ProgramProductService(db).delete_link(link_id)

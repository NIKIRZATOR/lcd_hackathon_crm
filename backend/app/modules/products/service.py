from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.products.model import ITProduct, ProgramProduct, Vendor
from app.modules.products.repository import ITProductRepository, ProgramProductRepository, VendorRepository
from app.modules.products.schemas import (
    ITProductCreate,
    ITProductUpdate,
    ProgramProductCreate,
    ProgramProductUpdate,
    VendorCreate,
    VendorUpdate,
)


class VendorService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = VendorRepository(db)

    def list_vendors(
        self,
        *,
        search: str | None,
        is_active: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[Vendor]:
        return self.repository.list(
            filters={"is_active": is_active},
            search=search,
            search_fields=("name", "description"),
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_vendor(self, vendor_id: UUID) -> Vendor:
        vendor = self.repository.get(vendor_id)
        if vendor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
        return vendor

    def create_vendor(self, payload: VendorCreate) -> Vendor:
        vendor = Vendor(**payload.model_dump())
        self.repository.add(vendor)
        self.db.commit()
        self.db.refresh(vendor)
        return vendor

    def update_vendor(self, vendor_id: UUID, payload: VendorUpdate) -> Vendor:
        vendor = self.get_vendor(vendor_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(vendor, field, value)
        self.db.commit()
        self.db.refresh(vendor)
        return vendor

    def deactivate_vendor(self, vendor_id: UUID) -> Vendor:
        vendor = self.get_vendor(vendor_id)
        vendor.is_active = False
        self.db.commit()
        self.db.refresh(vendor)
        return vendor


class ITProductService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = ITProductRepository(db)

    def list_products(
        self,
        *,
        search: str | None,
        vendor_id: UUID | None,
        is_active: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[ITProduct]:
        return self.repository.list(
            filters={"vendor_id": vendor_id, "is_active": is_active},
            search=search,
            search_fields=("name", "description", "documentation_url"),
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_product(self, product_id: UUID) -> ITProduct:
        product = self.repository.get(product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="IT product not found")
        return product

    def create_product(self, payload: ITProductCreate) -> ITProduct:
        product = ITProduct(**payload.model_dump())
        self.repository.add(product)
        self.db.commit()
        self.db.refresh(product)
        return product

    def update_product(self, product_id: UUID, payload: ITProductUpdate) -> ITProduct:
        product = self.get_product(product_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(product, field, value)
        self.db.commit()
        self.db.refresh(product)
        return product

    def deactivate_product(self, product_id: UUID) -> ITProduct:
        product = self.get_product(product_id)
        product.is_active = False
        self.db.commit()
        self.db.refresh(product)
        return product


class ProgramProductService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = ProgramProductRepository(db)

    def list_links(
        self,
        *,
        program_id: UUID | None,
        product_id: UUID | None,
        is_required: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[ProgramProduct]:
        return self.repository.list(
            filters={"program_id": program_id, "product_id": product_id, "is_required": is_required},
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_link(self, link_id: UUID) -> ProgramProduct:
        link = self.repository.get(link_id)
        if link is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program-product link not found")
        return link

    def create_link(self, payload: ProgramProductCreate) -> ProgramProduct:
        existing = self.repository.get_by_pair(payload.program_id, payload.product_id)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Program-product link already exists",
            )

        link = ProgramProduct(**payload.model_dump())
        self.repository.add(link)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid program-product link",
            ) from exc
        self.db.refresh(link)
        return link

    def update_link(self, link_id: UUID, payload: ProgramProductUpdate) -> ProgramProduct:
        link = self.get_link(link_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(link, field, value)
        self.db.commit()
        self.db.refresh(link)
        return link

    def delete_link(self, link_id: UUID) -> None:
        link = self.get_link(link_id)
        self.repository.delete(link)
        self.db.commit()

from uuid import UUID

from sqlalchemy import select

from app.common.repository import CRUDRepository
from app.modules.products.model import ITProduct, ProgramProduct, Vendor


class VendorRepository(CRUDRepository[Vendor]):
    model = Vendor
    sortable_fields = {"name", "is_active", "created_at", "updated_at"}
    default_sort = "name"


class ITProductRepository(CRUDRepository[ITProduct]):
    model = ITProduct
    sortable_fields = {"name", "is_active", "created_at", "updated_at"}
    default_sort = "name"


class ProgramProductRepository(CRUDRepository[ProgramProduct]):
    model = ProgramProduct
    sortable_fields = {"is_required", "created_at", "updated_at"}
    default_sort = "created_at"

    def get_by_pair(self, program_id: UUID, product_id: UUID) -> ProgramProduct | None:
        statement = select(ProgramProduct).where(
            ProgramProduct.program_id == program_id,
            ProgramProduct.product_id == product_id,
        )
        return self.db.scalar(statement)

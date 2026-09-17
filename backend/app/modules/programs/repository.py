from app.common.repository import CRUDRepository
from app.modules.programs.model import ITDirection, ITProgram


class ITDirectionRepository(CRUDRepository[ITDirection]):
    model = ITDirection
    sortable_fields = {"name", "code", "is_active", "created_at", "updated_at"}
    default_sort = "name"


class ITProgramRepository(CRUDRepository[ITProgram]):
    model = ITProgram
    sortable_fields = {"name", "version", "is_active", "created_at", "updated_at"}
    default_sort = "name"

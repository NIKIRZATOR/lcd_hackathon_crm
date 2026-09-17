from app.common.repository import CRUDRepository
from app.modules.contacts.model import UniversityContact


class UniversityContactRepository(CRUDRepository[UniversityContact]):
    model = UniversityContact
    sortable_fields = {
        "full_name",
        "position",
        "email",
        "department",
        "is_primary",
        "is_active",
        "created_at",
        "updated_at",
    }
    default_sort = "full_name"

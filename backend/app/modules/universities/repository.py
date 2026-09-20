from app.common.repository import CRUDRepository
from app.modules.universities.model import University


class UniversityRepository(CRUDRepository[University]):
    model = University
    sortable_fields = {"name", "short_name", "region", "city", "is_active", "created_at", "updated_at"}
    default_sort = "name"

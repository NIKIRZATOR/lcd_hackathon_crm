from uuid import UUID

from sqlalchemy import select

from app.common.repository import CRUDRepository
from app.modules.interactions.model import UniversityInteraction


class UniversityInteractionRepository(CRUDRepository[UniversityInteraction]):
    model = UniversityInteraction
    sortable_fields = {"status", "started_at", "completed_at", "created_at", "updated_at"}
    default_sort = "created_at"

    def list_by_current_stage(self, stage_instance_id: UUID) -> list[UniversityInteraction]:
        statement = select(UniversityInteraction).where(
            UniversityInteraction.current_stage_instance_id == stage_instance_id
        )
        return list(self.db.scalars(statement).all())

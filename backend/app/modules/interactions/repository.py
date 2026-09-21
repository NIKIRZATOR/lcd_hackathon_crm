from uuid import UUID

from sqlalchemy import asc, desc, func, select

from app.common.repository import CRUDRepository, ListResult
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

    def list_with_manager_scope(
        self,
        *,
        university_id: UUID | None,
        program_id: UUID | None,
        product_id: UUID | None,
        manager_user_id: UUID | set[UUID] | None,
        status_value: str | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[UniversityInteraction]:
        statement = select(UniversityInteraction)
        filters = {
            "university_id": university_id,
            "program_id": program_id,
            "product_id": product_id,
            "status": status_value,
        }
        for field, value in filters.items():
            if value is not None:
                statement = statement.where(getattr(UniversityInteraction, field) == value)

        if isinstance(manager_user_id, set):
            if not manager_user_id:
                return ListResult(items=[], total=0)
            statement = statement.where(UniversityInteraction.manager_user_id.in_(manager_user_id))
        elif manager_user_id is not None:
            statement = statement.where(UniversityInteraction.manager_user_id == manager_user_id)

        total = self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0
        order_column = getattr(self.model, self._resolve_sort_field(sort_by))
        order_expression = desc(order_column) if sort_order == "desc" else asc(order_column)
        items = list(self.db.scalars(statement.order_by(order_expression).limit(limit).offset(offset)).all())
        return ListResult(items=items, total=total)

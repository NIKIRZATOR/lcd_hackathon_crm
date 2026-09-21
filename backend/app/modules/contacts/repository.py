from uuid import UUID

from sqlalchemy import Select, asc, desc, exists, func, or_, select

from app.common.repository import CRUDRepository, ListResult
from app.modules.contacts.model import UniversityContact
from app.modules.interactions.model import UniversityInteraction


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

    def list_for_manager(
        self,
        *,
        manager_user_id: UUID,
        filters: dict[str, object | None],
        search: str | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[UniversityContact]:
        statement = self._build_scoped_statement(
            manager_user_id=manager_user_id,
            filters=filters,
            search=search,
        )
        total = self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0
        order_column = getattr(self.model, self._resolve_sort_field(sort_by))
        order_expression = desc(order_column) if sort_order == "desc" else asc(order_column)
        items = list(self.db.scalars(statement.order_by(order_expression).limit(limit).offset(offset)).all())
        return ListResult(items=items, total=total)

    def _build_scoped_statement(
        self,
        *,
        manager_user_id: UUID,
        filters: dict[str, object | None],
        search: str | None,
    ) -> Select[tuple[UniversityContact]]:
        statement = select(UniversityContact).where(
            exists().where(
                UniversityInteraction.university_id == UniversityContact.university_id,
                UniversityInteraction.manager_user_id == manager_user_id,
            )
        )

        for field, value in filters.items():
            if value is not None:
                statement = statement.where(getattr(UniversityContact, field) == value)

        if search:
            pattern = f"%{search}%"
            statement = statement.where(
                or_(
                    UniversityContact.full_name.ilike(pattern),
                    UniversityContact.position.ilike(pattern),
                    UniversityContact.email.ilike(pattern),
                    UniversityContact.phone.ilike(pattern),
                    UniversityContact.department.ilike(pattern),
                )
            )

        return statement

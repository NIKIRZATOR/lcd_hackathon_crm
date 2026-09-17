from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import Select, asc, desc, func, or_, select
from sqlalchemy.orm import Session

ModelT = TypeVar("ModelT")


class ListResult(Generic[ModelT]):
    def __init__(self, items: list[ModelT], total: int) -> None:
        self.items = items
        self.total = total


class CRUDRepository(Generic[ModelT]):
    model: type[ModelT]
    sortable_fields: set[str] = {"created_at", "updated_at"}
    default_sort: str = "created_at"

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, entity_id: UUID) -> ModelT | None:
        return self.db.get(self.model, entity_id)

    def list(
        self,
        *,
        filters: dict[str, Any] | None = None,
        search: str | None = None,
        search_fields: tuple[str, ...] = (),
        limit: int = 50,
        offset: int = 0,
        sort_by: str | None = None,
        sort_order: str = "asc",
    ) -> ListResult[ModelT]:
        statement = self._build_list_statement(filters=filters, search=search, search_fields=search_fields)
        total = self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0

        order_column = getattr(self.model, self._resolve_sort_field(sort_by))
        order_expression = desc(order_column) if sort_order == "desc" else asc(order_column)
        items = list(self.db.scalars(statement.order_by(order_expression).limit(limit).offset(offset)).all())
        return ListResult(items=items, total=total)

    def add(self, entity: ModelT) -> ModelT:
        self.db.add(entity)
        self.db.flush()
        return entity

    def delete(self, entity: ModelT) -> None:
        self.db.delete(entity)
        self.db.flush()

    def _build_list_statement(
        self,
        *,
        filters: dict[str, Any] | None,
        search: str | None,
        search_fields: tuple[str, ...],
    ) -> Select[tuple[ModelT]]:
        statement = select(self.model)

        for field, value in (filters or {}).items():
            if value is not None:
                statement = statement.where(getattr(self.model, field) == value)

        if search:
            pattern = f"%{search}%"
            clauses = [getattr(self.model, field).ilike(pattern) for field in search_fields]
            if clauses:
                statement = statement.where(or_(*clauses))

        return statement

    def _resolve_sort_field(self, sort_by: str | None) -> str:
        if sort_by and sort_by in self.sortable_fields:
            return sort_by
        return self.default_sort

from collections import Counter
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Select, and_, asc, desc, exists, false, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.common.repository import ListResult
from app.modules.auth.access import get_subordinate_kam_ids, get_user_roles
from app.modules.interactions.model import UniversityInteraction
from app.modules.licenses.model import Contract, License
from app.modules.products.model import ITProduct, Vendor
from app.modules.programs.model import ITDirection, ITProgram
from app.modules.reports.read_models import REPORT_COLUMNS, SORTABLE_REPORT_COLUMNS, ReportColumn, ReportRow
from app.modules.reports.schemas import ReportFilter
from app.modules.universities.model import University
from app.modules.users.model import DataAccessScope, User
from app.modules.workflows.model import WorkflowStage, WorkflowStageInstance


class ReportQueryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.current_stage_instance = aliased(WorkflowStageInstance)

    def get_columns(self) -> list[ReportColumn]:
        return list(REPORT_COLUMNS.values())

    def build_query(self, report_filter: ReportFilter, current_user: User) -> Select[tuple[Any, ...]]:
        current_stage_instance = self.current_stage_instance
        statement = (
            select(
                UniversityInteraction.id.label("interaction_id"),
                University.id.label("university_id"),
                University.name.label("university_name"),
                ITDirection.id.label("direction_id"),
                ITDirection.name.label("direction_name"),
                ITProgram.id.label("program_id"),
                ITProgram.name.label("program_name"),
                ITProduct.id.label("product_id"),
                ITProduct.name.label("product_name"),
                Vendor.id.label("vendor_id"),
                Vendor.name.label("vendor_name"),
                Contract.id.label("contract_id"),
                Contract.number.label("contract_number"),
                Contract.signed_at.label("contract_signed_at"),
                Contract.valid_from.label("contract_valid_from"),
                Contract.valid_until.label("contract_valid_until"),
                License.id.label("license_id"),
                License.license_number.label("license_number"),
                License.signed_at.label("license_signed_at"),
                License.valid_until.label("license_valid_until"),
                License.transfer_status.label("transfer_status"),
                User.id.label("responsible_user_id"),
                User.full_name.label("responsible_name"),
                UniversityInteraction.status.label("interaction_status"),
                WorkflowStage.id.label("workflow_stage_id"),
                WorkflowStage.name.label("workflow_stage_name"),
                current_stage_instance.status.label("workflow_stage_status"),
                UniversityInteraction.comment.label("comment"),
                UniversityInteraction.started_at.label("started_at"),
                UniversityInteraction.completed_at.label("completed_at"),
                UniversityInteraction.created_at.label("created_at"),
                UniversityInteraction.updated_at.label("updated_at"),
            )
            .select_from(UniversityInteraction)
            .join(University, University.id == UniversityInteraction.university_id)
            .join(ITProgram, ITProgram.id == UniversityInteraction.program_id)
            .outerjoin(ITDirection, ITDirection.id == ITProgram.direction_id)
            .join(ITProduct, ITProduct.id == UniversityInteraction.product_id)
            .outerjoin(Vendor, Vendor.id == ITProduct.vendor_id)
            .outerjoin(User, User.id == UniversityInteraction.manager_user_id)
            .outerjoin(Contract, Contract.interaction_id == UniversityInteraction.id)
            .outerjoin(
                License,
                and_(
                    License.contract_id == Contract.id,
                    License.product_id == UniversityInteraction.product_id,
                ),
            )
            .outerjoin(
                current_stage_instance,
                current_stage_instance.id == UniversityInteraction.current_stage_instance_id,
            )
            .outerjoin(WorkflowStage, WorkflowStage.id == current_stage_instance.workflow_stage_id)
        )

        statement = self._apply_data_scope(statement, current_user)
        statement = self._apply_filters(statement, report_filter)
        return self._apply_sort(statement, report_filter)

    def count(self, report_filter: ReportFilter, current_user: User) -> int:
        statement = self.build_query(report_filter, current_user)
        return self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0

    def preview(
        self,
        report_filter: ReportFilter,
        current_user: User,
        *,
        limit: int,
        offset: int = 0,
    ) -> ListResult[ReportRow]:
        total = self.count(report_filter, current_user)
        rows = self.fetch_rows(report_filter, current_user, limit=limit, offset=offset)
        return ListResult(items=rows, total=total)

    def fetch_rows(
        self,
        report_filter: ReportFilter,
        current_user: User,
        *,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[ReportRow]:
        statement = self.build_query(report_filter, current_user)
        if offset is not None:
            statement = statement.offset(offset)
        if limit is not None:
            statement = statement.limit(limit)
        mappings = self.db.execute(statement).mappings().all()
        return [self._map_row(row) for row in mappings]

    def aggregate(self, report_filter: ReportFilter, current_user: User) -> dict[str, dict[str, int]]:
        rows = self.fetch_rows(report_filter, current_user)
        return {
            "status_distribution": self._counter(rows, "interaction_status"),
            "directions": self._counter(rows, "direction_name"),
            "products": self._counter(rows, "product_name"),
            "universities": self._counter(rows, "university_name"),
            "responsible_users": self._counter(rows, "responsible_name"),
        }

    def _apply_data_scope(self, statement: Select[tuple[Any, ...]], current_user: User) -> Select[tuple[Any, ...]]:
        roles = get_user_roles(current_user)
        if "ADMIN" in roles:
            return statement
        if not roles & {"KAM", "MANAGER"}:
            return statement.where(false())

        manager_ids = set()
        if "MANAGER" in roles:
            manager_ids = get_subordinate_kam_ids(self.db, current_user.id)
        elif "KAM" in roles:
            manager_ids = {current_user.id}

        scope_conditions = []
        if manager_ids:
            scope_conditions.append(UniversityInteraction.manager_user_id.in_(manager_ids))

        explicit_scope = self._explicit_scope_exists(current_user)
        scope_conditions.append(explicit_scope)

        if not scope_conditions:
            return statement.where(false())
        return statement.where(or_(*scope_conditions))

    def _explicit_scope_exists(self, current_user: User):
        now = datetime.now(timezone.utc)
        return exists().where(
            DataAccessScope.subject_user_id == current_user.id,
            DataAccessScope.is_active.is_(True),
            or_(DataAccessScope.valid_from.is_(None), DataAccessScope.valid_from <= now),
            or_(DataAccessScope.valid_to.is_(None), DataAccessScope.valid_to >= now),
            DataAccessScope.access_level.in_(["READ", "WRITE"]),
            or_(
                DataAccessScope.interaction_id == UniversityInteraction.id,
                DataAccessScope.university_id == UniversityInteraction.university_id,
            ),
        )

    def _apply_filters(
        self,
        statement: Select[tuple[Any, ...]],
        report_filter: ReportFilter,
    ) -> Select[tuple[Any, ...]]:
        current_stage_instance = self.current_stage_instance
        if report_filter.date_from is not None:
            statement = statement.where(UniversityInteraction.started_at >= report_filter.date_from)
        if report_filter.date_to is not None:
            statement = statement.where(UniversityInteraction.started_at <= report_filter.date_to)
        if report_filter.university_ids:
            statement = statement.where(UniversityInteraction.university_id.in_(report_filter.university_ids))
        if report_filter.direction_ids:
            statement = statement.where(ITProgram.direction_id.in_(report_filter.direction_ids))
        if report_filter.program_ids:
            statement = statement.where(UniversityInteraction.program_id.in_(report_filter.program_ids))
        if report_filter.product_ids:
            statement = statement.where(UniversityInteraction.product_id.in_(report_filter.product_ids))
        if report_filter.responsible_user_ids:
            statement = statement.where(UniversityInteraction.manager_user_id.in_(report_filter.responsible_user_ids))
        if report_filter.interaction_statuses:
            statement = statement.where(UniversityInteraction.status.in_(report_filter.interaction_statuses))
        if report_filter.workflow_stage_ids:
            statement = statement.where(current_stage_instance.workflow_stage_id.in_(report_filter.workflow_stage_ids))
        return statement

    def _apply_sort(
        self,
        statement: Select[tuple[Any, ...]],
        report_filter: ReportFilter,
    ) -> Select[tuple[Any, ...]]:
        sort_column = self._sort_column(report_filter.sort_by)
        sort_expression = desc(sort_column) if report_filter.sort_direction == "desc" else asc(sort_column)
        return statement.order_by(sort_expression, UniversityInteraction.id.asc())

    def _sort_column(self, sort_by: str):
        if sort_by not in SORTABLE_REPORT_COLUMNS:
            sort_by = "started_at"
        columns = {
            "university_name": University.name,
            "direction_name": ITDirection.name,
            "program_name": ITProgram.name,
            "product_name": ITProduct.name,
            "vendor_name": Vendor.name,
            "interaction_status": UniversityInteraction.status,
            "responsible_name": User.full_name,
            "contract_number": Contract.number,
            "contract_signed_at": Contract.signed_at,
            "contract_valid_from": Contract.valid_from,
            "contract_valid_until": Contract.valid_until,
            "license_number": License.license_number,
            "license_signed_at": License.signed_at,
            "license_valid_until": License.valid_until,
            "transfer_status": License.transfer_status,
            "workflow_stage_name": WorkflowStage.name,
            "workflow_stage_status": self.current_stage_instance.status,
            "started_at": UniversityInteraction.started_at,
            "completed_at": UniversityInteraction.completed_at,
            "created_at": UniversityInteraction.created_at,
            "updated_at": UniversityInteraction.updated_at,
        }
        return columns[sort_by]

    def _map_row(self, row: Any) -> ReportRow:
        data = dict(row)
        return ReportRow(**data)

    def _counter(self, rows: list[ReportRow], field: str) -> dict[str, int]:
        values = (getattr(row, field) or "N/A" for row in rows)
        return dict(Counter(values))

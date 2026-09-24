from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.reports.read_models import DEFAULT_REPORT_COLUMNS, REPORT_COLUMNS, SORTABLE_REPORT_COLUMNS

ReportSortDirection = Literal["asc", "desc"]


class ReportColumnRead(BaseModel):
    key: str
    label: str
    data_type: str
    source: str
    sortable: bool
    default_visible: bool
    exportable: bool


class ReportFilter(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "date_from": "2026-01-01T00:00:00Z",
                    "date_to": "2026-12-31T23:59:59Z",
                    "university_ids": ["11111111-1111-1111-1111-111111111111"],
                    "direction_ids": ["22222222-2222-2222-2222-222222222222"],
                    "program_ids": [],
                    "product_ids": [],
                    "responsible_user_ids": ["33333333-3333-3333-3333-333333333333"],
                    "interaction_statuses": ["ACTIVE"],
                    "workflow_stage_ids": [],
                    "columns": list(DEFAULT_REPORT_COLUMNS),
                    "sort_by": "started_at",
                    "sort_direction": "desc",
                }
            ]
        }
    )

    date_from: datetime | None = Field(
        default=None,
        description="Interaction period start. Filters by university_interactions.started_at.",
    )
    date_to: datetime | None = Field(
        default=None,
        description="Interaction period end. Filters by university_interactions.started_at.",
    )
    university_ids: list[UUID] = Field(default_factory=list)
    direction_ids: list[UUID] = Field(default_factory=list)
    program_ids: list[UUID] = Field(default_factory=list)
    product_ids: list[UUID] = Field(default_factory=list)
    responsible_user_ids: list[UUID] = Field(default_factory=list)
    interaction_statuses: list[str] = Field(default_factory=list)
    workflow_stage_ids: list[UUID] = Field(default_factory=list)
    columns: list[str] = Field(default_factory=lambda: list(DEFAULT_REPORT_COLUMNS))
    sort_by: str = "started_at"
    sort_direction: ReportSortDirection = "desc"

    @model_validator(mode="after")
    def validate_filter(self) -> "ReportFilter":
        if self.date_from is not None and self.date_to is not None and self.date_from > self.date_to:
            raise ValueError("date_from must be less than or equal to date_to")

        unknown_columns = [column for column in self.columns if column not in REPORT_COLUMNS]
        if unknown_columns:
            raise ValueError(f"Unsupported report columns: {', '.join(sorted(set(unknown_columns)))}")

        if self.sort_by not in SORTABLE_REPORT_COLUMNS:
            raise ValueError(f"Unsupported report sort field: {self.sort_by}")

        return self


class ReportPreviewRead(BaseModel):
    rows: list[dict[str, object | None]]
    total: int
    columns: list[ReportColumnRead]
    limit: int
    offset: int

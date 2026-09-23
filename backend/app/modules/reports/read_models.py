from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class ReportColumn:
    key: str
    label: str
    data_type: str
    source: str
    sortable: bool = False
    default_visible: bool = False
    exportable: bool = True


@dataclass(frozen=True, slots=True)
class ReportRow:
    interaction_id: UUID
    university_id: UUID
    university_name: str
    direction_id: UUID | None
    direction_name: str | None
    program_id: UUID
    program_name: str
    product_id: UUID
    product_name: str
    vendor_id: UUID | None
    vendor_name: str | None
    contract_id: UUID | None
    contract_number: str | None
    contract_signed_at: datetime | None
    contract_valid_from: datetime | None
    contract_valid_until: datetime | None
    license_id: UUID | None
    license_number: str | None
    license_signed_at: datetime | None
    license_valid_until: datetime | None
    transfer_status: str | None
    responsible_user_id: UUID | None
    responsible_name: str | None
    interaction_status: str
    workflow_stage_id: UUID | None
    workflow_stage_name: str | None
    workflow_stage_status: str | None
    comment: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


REPORT_COLUMNS: dict[str, ReportColumn] = {
    "university_name": ReportColumn(
        key="university_name",
        label="University",
        data_type="string",
        source="universities.name",
        sortable=True,
        default_visible=True,
    ),
    "direction_name": ReportColumn(
        key="direction_name",
        label="IT direction",
        data_type="string",
        source="it_directions.name",
        sortable=True,
        default_visible=True,
    ),
    "program_name": ReportColumn(
        key="program_name",
        label="IT program",
        data_type="string",
        source="it_programs.name",
        sortable=True,
    ),
    "product_name": ReportColumn(
        key="product_name",
        label="IT product",
        data_type="string",
        source="it_products.name",
        sortable=True,
        default_visible=True,
    ),
    "vendor_name": ReportColumn(
        key="vendor_name",
        label="Vendor",
        data_type="string",
        source="vendors.name",
        sortable=True,
    ),
    "interaction_status": ReportColumn(
        key="interaction_status",
        label="Interaction status",
        data_type="string",
        source="university_interactions.status",
        sortable=True,
        default_visible=True,
    ),
    "responsible_name": ReportColumn(
        key="responsible_name",
        label="Responsible user",
        data_type="string",
        source="users.full_name",
        sortable=True,
        default_visible=True,
    ),
    "contract_number": ReportColumn(
        key="contract_number",
        label="Contract number",
        data_type="string",
        source="contracts.number",
        sortable=True,
    ),
    "contract_signed_at": ReportColumn(
        key="contract_signed_at",
        label="Contract signed at",
        data_type="datetime",
        source="contracts.signed_at",
        sortable=True,
    ),
    "contract_valid_from": ReportColumn(
        key="contract_valid_from",
        label="Contract valid from",
        data_type="datetime",
        source="contracts.valid_from",
        sortable=True,
    ),
    "contract_valid_until": ReportColumn(
        key="contract_valid_until",
        label="Contract valid until",
        data_type="datetime",
        source="contracts.valid_until",
        sortable=True,
    ),
    "license_number": ReportColumn(
        key="license_number",
        label="License number",
        data_type="string",
        source="licenses.license_number",
        sortable=True,
    ),
    "license_signed_at": ReportColumn(
        key="license_signed_at",
        label="License signed at",
        data_type="datetime",
        source="licenses.signed_at",
        sortable=True,
    ),
    "license_valid_until": ReportColumn(
        key="license_valid_until",
        label="License valid until",
        data_type="datetime",
        source="licenses.valid_until",
        sortable=True,
    ),
    "transfer_status": ReportColumn(
        key="transfer_status",
        label="Transfer status",
        data_type="string",
        source="licenses.transfer_status",
        sortable=True,
    ),
    "workflow_stage_name": ReportColumn(
        key="workflow_stage_name",
        label="Workflow stage",
        data_type="string",
        source="workflow_stages.name",
        sortable=True,
    ),
    "workflow_stage_status": ReportColumn(
        key="workflow_stage_status",
        label="Workflow stage status",
        data_type="string",
        source="workflow_stage_instances.status",
        sortable=True,
    ),
    "comment": ReportColumn(
        key="comment",
        label="Comment",
        data_type="string",
        source="university_interactions.comment",
        exportable=True,
    ),
    "started_at": ReportColumn(
        key="started_at",
        label="Started at",
        data_type="datetime",
        source="university_interactions.started_at",
        sortable=True,
    ),
    "completed_at": ReportColumn(
        key="completed_at",
        label="Completed at",
        data_type="datetime",
        source="university_interactions.completed_at",
        sortable=True,
    ),
    "created_at": ReportColumn(
        key="created_at",
        label="Created at",
        data_type="datetime",
        source="university_interactions.created_at",
        sortable=True,
    ),
    "updated_at": ReportColumn(
        key="updated_at",
        label="Updated at",
        data_type="datetime",
        source="university_interactions.updated_at",
        sortable=True,
    ),
}

DEFAULT_REPORT_COLUMNS = tuple(
    column.key for column in REPORT_COLUMNS.values() if column.default_visible
)
SORTABLE_REPORT_COLUMNS = frozenset(
    column.key for column in REPORT_COLUMNS.values() if column.sortable
)

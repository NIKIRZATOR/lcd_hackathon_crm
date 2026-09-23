from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.reports.read_models import DEFAULT_REPORT_COLUMNS, REPORT_COLUMNS, ReportRow
from app.modules.reports.schemas import ReportFilter


def test_report_filter_defaults_to_required_columns() -> None:
    report_filter = ReportFilter()

    assert report_filter.columns == list(DEFAULT_REPORT_COLUMNS)
    assert set(report_filter.columns) == {
        "university_name",
        "direction_name",
        "product_name",
        "interaction_status",
        "responsible_name",
    }
    assert report_filter.sort_by == "started_at"
    assert report_filter.sort_direction == "desc"


def test_report_filter_rejects_invalid_period() -> None:
    with pytest.raises(ValidationError):
        ReportFilter(
            date_from=datetime(2026, 2, 1, tzinfo=timezone.utc),
            date_to=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )


def test_report_filter_rejects_unknown_column() -> None:
    with pytest.raises(ValidationError):
        ReportFilter(columns=["university_name", "unknown_column"])


def test_report_filter_rejects_unknown_sort_field() -> None:
    with pytest.raises(ValidationError):
        ReportFilter(sort_by="comment")


def test_report_column_registry_contains_normalized_contract_license_fields() -> None:
    assert REPORT_COLUMNS["contract_number"].source == "contracts.number"
    assert REPORT_COLUMNS["license_valid_until"].source == "licenses.valid_until"
    assert REPORT_COLUMNS["transfer_status"].source == "licenses.transfer_status"


def test_report_row_is_canonical_read_model() -> None:
    now = datetime.now(timezone.utc)
    interaction_id = uuid4()
    university_id = uuid4()
    program_id = uuid4()
    product_id = uuid4()

    row = ReportRow(
        interaction_id=interaction_id,
        university_id=university_id,
        university_name="RTK Demo University",
        direction_id=None,
        direction_name=None,
        program_id=program_id,
        program_name="Applied AI",
        product_id=product_id,
        product_name="Demo Product",
        vendor_id=None,
        vendor_name=None,
        contract_id=None,
        contract_number=None,
        contract_signed_at=None,
        contract_valid_from=None,
        contract_valid_until=None,
        license_id=None,
        license_number=None,
        license_signed_at=None,
        license_valid_until=None,
        transfer_status=None,
        responsible_user_id=None,
        responsible_name=None,
        interaction_status="ACTIVE",
        workflow_stage_id=None,
        workflow_stage_name=None,
        workflow_stage_status=None,
        comment=None,
        started_at=now,
        completed_at=None,
        created_at=now,
        updated_at=now,
    )

    assert row.interaction_id == interaction_id
    assert row.university_id == university_id
    assert row.program_id == program_id
    assert row.product_id == product_id
    assert row.interaction_status == "ACTIVE"

from uuid import uuid4

from app.modules.integrations.model import ProgramMetric
from app.modules.integrations.schemas import ProgramMetricRead
from app.modules.integrations.service import IntegrationSyncService


def test_program_metric_serializes_from_orm_model() -> None:
    metric = ProgramMetric(
        program_instance_id=uuid4(),
        applications_count=14,
        students_count=48,
        streams_count=2,
    )

    result = ProgramMetricRead.model_validate(metric)

    assert result.applications_count == 14
    assert result.students_count == 48


def test_mock_fixture_contains_mapped_unmatched_and_error_signals() -> None:
    statuses = {signal["status"] for signal in IntegrationSyncService._fixture_signals()}

    assert statuses == {"mapped", "unmatched", "error"}

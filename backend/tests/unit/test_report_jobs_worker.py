from datetime import datetime, timezone
from uuid import uuid4

from app.core.database import Base
from app.modules.audit.model import AuditEvent
from app.modules.reports.model import ReportArtifact, ReportJob
from app.modules.reports.queue import dequeue_report_job, enqueue_report_job
from app.worker.reports import ReportWorker, render_report


class FakeRedis:
    def __init__(self) -> None:
        self.items = []

    def lpush(self, queue_name: str, value: str) -> None:
        self.items.insert(0, (queue_name, value))

    def brpop(self, queue_name: str, timeout: int):
        if not self.items:
            return None
        _, value = self.items.pop()
        return queue_name, value


def test_report_queue_roundtrip_uses_uuid_strings() -> None:
    redis = FakeRedis()
    job_id = uuid4()

    enqueue_report_job(job_id, redis_client=redis, queue_name="reports-test")
    dequeued = dequeue_report_job(redis_client=redis, queue_name="reports-test", timeout_seconds=1)

    assert dequeued == job_id


def test_report_models_are_registered_in_metadata() -> None:
    assert "report_jobs" in Base.metadata.tables
    assert "report_artifacts" in Base.metadata.tables
    assert ReportJob.__tablename__ == "report_jobs"
    assert ReportArtifact.__tablename__ == "report_artifacts"


def test_report_exporters_build_all_required_formats() -> None:
    rows = [{"organization": "Тестовый вуз", "applications": 3}]

    xlsx, _, _ = render_report(rows, ["organization", "applications"], "XLSX")
    xls, _, _ = render_report(rows, ["organization", "applications"], "XLS")
    pdf, _, _ = render_report(rows, ["organization", "applications"], "PDF")

    assert xlsx.startswith(b"PK")
    assert xls.startswith(bytes.fromhex("D0CF11E0"))
    assert pdf.startswith(b"%PDF-")


def test_report_worker_marks_job_failed_when_creator_is_missing() -> None:
    job = ReportJob(
        id=uuid4(),
        status="QUEUED",
        format="XLSX",
        filter_snapshot={},
        columns_snapshot=["university_name"],
        created_by=uuid4(),
        queued_at=datetime.now(timezone.utc),
        row_count=0,
    )

    class FakeDb:
        def __init__(self) -> None:
            self.added = []
            self.commits = 0
            self.refreshed = None

        def get(self, model, entity_id):
            if model is ReportJob and entity_id == job.id:
                return job
            return None

        def add(self, entity):
            self.added.append(entity)

        def flush(self):
            return None

        def commit(self):
            self.commits += 1

        def refresh(self, entity):
            self.refreshed = entity

    db = FakeDb()

    result = ReportWorker(db).process_job(job.id)

    assert result is job
    assert job.status == "FAILED"
    assert job.started_at is not None
    assert job.finished_at is not None
    assert job.error_code == "REPORT_EXPORT_FAILED"
    assert db.commits == 2
    assert db.refreshed is job
    assert [event.action for event in db.added if isinstance(event, AuditEvent)] == [
        "report.job.started",
        "report.job.failed",
    ]

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.reports.model import ReportJob
from app.modules.reports.queue import dequeue_report_job


class ReportWorker:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.audit = AuditEventRepository(db)

    def process_job(self, job_id: UUID) -> ReportJob | None:
        job = self.db.get(ReportJob, job_id)
        if job is None:
            return None
        if job.status not in {"QUEUED", "FAILED"}:
            return job

        now = datetime.now(timezone.utc)
        job.status = "RUNNING"
        job.started_at = now
        job.error_code = None
        job.error_message = None
        self.audit.add(
            AuditEvent(
                actor_user_id=job.created_by,
                action="report.job.started",
                entity_type="report_job",
                entity_id=job.id,
                event_metadata={"format": job.format},
                request_id=job.request_id,
            )
        )
        self.db.commit()

        job.status = "FAILED"
        job.finished_at = datetime.now(timezone.utc)
        job.error_code = "REPORT_EXPORTER_NOT_IMPLEMENTED"
        job.error_message = "Report exporters are not implemented yet."
        self.audit.add(
            AuditEvent(
                actor_user_id=job.created_by,
                action="report.job.failed",
                entity_type="report_job",
                entity_id=job.id,
                result="FAILED",
                error_code=job.error_code,
                event_metadata={"format": job.format},
                request_id=job.request_id,
            )
        )
        self.db.commit()
        self.db.refresh(job)
        return job

    def process_one(self) -> ReportJob | None:
        job_id = dequeue_report_job()
        if job_id is None:
            return None
        return self.process_job(job_id)


def main() -> None:
    while True:
        db = SessionLocal()
        try:
            ReportWorker(db).process_one()
        finally:
            db.close()


if __name__ == "__main__":
    main()

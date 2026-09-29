import json
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.documents.model import File
from app.modules.reports.model import ReportArtifact, ReportJob
from app.modules.reports.program_router import ProgramReportFilter, _statement
from app.modules.reports.queue import dequeue_report_job
from app.modules.users.model import User
from app.storage.factory import get_storage_adapter


REPORT_COLUMNS = {
    "organization": "Вуз", "direction": "Направление", "product": "Продукт", "status": "Статус",
    "stage": "Текущий этап", "responsible": "KAM", "playbook": "Плейбук", "health_band": "Health",
    "license_number": "Лицензия", "applications": "Заявки *", "payment_records": "Заказы *",
    "students": "Студенты *", "streams": "Потоки *",
}


def _export_columns(columns: list[str]) -> list[str]:
    selected = [column for column in columns if column in REPORT_COLUMNS]
    return selected or list(REPORT_COLUMNS)


def _cell(value: object) -> str | int | float:
    if value is None:
        return ""
    return value if isinstance(value, (str, int, float)) else str(value)


def render_report(
    rows: list[dict[str, object]],
    columns: list[str],
    report_format: str,
    filter_snapshot: dict[str, object] | None = None,
) -> tuple[bytes, str, str]:
    selected = _export_columns(columns)
    values = [[REPORT_COLUMNS[column] for column in selected]] + [[_cell(row.get(column)) for column in selected] for row in rows]
    if report_format == "JSON":
        payload = {
            "schema_version": "1.0",
            "report_type": "programs",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "filters": filter_snapshot or {},
            "columns": [
                {"key": column, "title": REPORT_COLUMNS[column]}
                for column in selected
            ],
            "row_count": len(rows),
            "items": [
                {column: row.get(column) for column in selected}
                for row in rows
            ],
        }
        return (
            json.dumps(payload, ensure_ascii=False, indent=2, default=str).encode("utf-8"),
            "application/json; charset=utf-8",
            "json",
        )
    if report_format == "XLSX":
        from openpyxl import Workbook

        book = Workbook()
        sheet = book.active
        sheet.title = "Программы"
        for row in values:
            sheet.append(row)
        for column_cells in sheet.columns:
            sheet.column_dimensions[column_cells[0].column_letter].width = min(max(len(str(cell.value or "")) for cell in column_cells) + 2, 40)
        stream = BytesIO()
        book.save(stream)
        return stream.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
    if report_format == "XLS":
        import xlwt

        book = xlwt.Workbook(encoding="utf-8")
        sheet = book.add_sheet("Программы")
        for row_index, row in enumerate(values):
            for column_index, value in enumerate(row):
                sheet.write(row_index, column_index, value)
        stream = BytesIO()
        book.save(stream)
        return stream.getvalue(), "application/vnd.ms-excel", "xls"
    if report_format == "PDF":
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        font_name = "DejaVuSans"
        pdfmetrics.registerFont(TTFont(font_name, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
        stream = BytesIO()
        document = SimpleDocTemplate(stream, pagesize=landscape(A4), leftMargin=18, rightMargin=18, topMargin=18, bottomMargin=18)
        table = Table(values, repeatRows=1)
        table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f2f5")), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d9d9d9")), ("FONTNAME", (0, 0), (-1, -1), font_name), ("FONTSIZE", (0, 0), (-1, -1), 7), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        title = getSampleStyleSheet()["Title"]
        title.fontName = font_name
        document.build([Paragraph("Отчёт по программам", title), Spacer(1, 10), table])
        return stream.getvalue(), "application/pdf", "pdf"
    raise ValueError(f"Unsupported report format: {report_format}")


class ReportWorker:
    def __init__(self, db: Session, storage=None) -> None:
        self.db = db
        self.storage = storage or get_storage_adapter()
        self.audit = AuditEventRepository(db)

    def process_job(self, job_id: UUID) -> ReportJob | None:
        job = self.db.get(ReportJob, job_id)
        if job is None or job.status not in {"QUEUED", "FAILED"}:
            return job

        job.status = "RUNNING"
        job.started_at = datetime.now(timezone.utc)
        job.error_code = None
        job.error_message = None
        self.audit.add(AuditEvent(actor_user_id=job.created_by, action="report.job.started", entity_type="report_job", entity_id=job.id, event_metadata={"format": job.format}, request_id=job.request_id))
        self.db.commit()

        try:
            creator = self.db.get(User, job.created_by)
            if creator is None:
                raise ValueError("Report creator was not found")
            payload = ProgramReportFilter.model_validate(job.filter_snapshot)
            rows = [dict(row) for row in self.db.execute(_statement(payload, self.db, creator)).mappings().all()]
            content, mime_type, extension = render_report(
                rows,
                job.columns_snapshot,
                job.format,
                filter_snapshot=job.filter_snapshot,
            )
            object_key = f"reports/{job.id}/programs-report.{extension}"
            self.storage.put(bucket=settings.s3_bucket_reports, object_key=object_key, data=BytesIO(content), length=len(content), content_type=mime_type)
            file = File(original_name=f"programs-report.{extension}", storage_name=object_key.rsplit("/", 1)[-1], storage_path=object_key, mime_type=mime_type, extension=extension, size_bytes=len(content), checksum=sha256(content).hexdigest(), provider="minio", bucket=settings.s3_bucket_reports, object_key=object_key, attachment_kind="REPORT", uploaded_by=job.created_by)
            self.db.add(file)
            self.db.flush()
            self.db.add(ReportArtifact(report_job_id=job.id, file_id=file.id, artifact_type="PROGRAM_REPORT", format=job.format, row_count=len(rows)))
            job.status = "DONE"
            job.finished_at = datetime.now(timezone.utc)
            job.row_count = len(rows)
            self.audit.add(AuditEvent(actor_user_id=job.created_by, action="report.job.completed", entity_type="report_job", entity_id=job.id, result="DONE", event_metadata={"format": job.format, "row_count": len(rows)}, request_id=job.request_id))
            self.db.commit()
        except Exception as exc:
            if hasattr(self.db, "rollback"):
                self.db.rollback()
            job = self.db.get(ReportJob, job_id)
            if job is None:
                return None
            job.status = "FAILED"
            job.finished_at = datetime.now(timezone.utc)
            job.error_code = "REPORT_EXPORT_FAILED"
            job.error_message = str(exc)[:1000]
            self.audit.add(AuditEvent(actor_user_id=job.created_by, action="report.job.failed", entity_type="report_job", entity_id=job.id, result="FAILED", error_code=job.error_code, event_metadata={"format": job.format}, request_id=job.request_id))
            self.db.commit()
        self.db.refresh(job)
        return job

    def process_one(self) -> ReportJob | None:
        job_id = dequeue_report_job()
        return self.process_job(job_id) if job_id else None


def main() -> None:
    while True:
        db = SessionLocal()
        try:
            ReportWorker(db).process_one()
        finally:
            db.close()


if __name__ == "__main__":
    main()

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.audit.model import AuditEvent
from app.modules.imports.model import ImportJob
from app.modules.integrations.model import IntegrationSignal
from app.modules.integrations.service import IntegrationSyncService
from app.modules.reports.model import ReportJob
from app.modules.system_status.service import PlatformStatusService
from app.modules.users.model import User
from app.modules.workflows.model import WorkflowTemplate


AUDIT_ACTION_LABELS = {
    "integration.package.process": "Обработан пакет интеграции",
    "integration.mapping.apply_and_replay": "Создано сопоставление и запущен replay",
    "integration.replay": "Повторно обработаны сигналы",
    "import.upload": "Загружен файл импорта",
    "import.validate": "Проверен импорт",
    "import.complete": "Импорт применён",
    "import.fail": "Импорт завершился с ошибкой",
    "report.job.queued": "Отчёт добавлен в очередь",
    "report.job.completed": "Отчёт сформирован",
    "report.job.failed": "Отчёт завершился с ошибкой",
    "workflow.version.draft_created": "Создан черновик шаблона workflow",
    "workflow.version.published": "Опубликована версия шаблона workflow",
}


class AdminHomeService:
    """Compose ADMIN Home data from existing operational subsystems."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def summary(self) -> dict[str, Any]:
        unmatched = self._count(IntegrationSignal, IntegrationSignal.status == "unmatched")
        integration_errors = self._count(IntegrationSignal, IntegrationSignal.status == "error")
        failed_imports = self._count(ImportJob, ImportJob.status == "FAILED")
        failed_reports = self._count(ReportJob, ReportJob.status == "FAILED")
        running_reports = self._count(ReportJob, ReportJob.status.in_(("QUEUED", "RUNNING")))
        draft_templates = self._count(WorkflowTemplate, WorkflowTemplate.status == "draft")

        return {
            "role": "ADMIN",
            "cards": {
                "unmatched_integrations": unmatched,
                "integration_errors": integration_errors,
                "import_jobs": failed_imports,
                "report_jobs": failed_reports,
                "running_reports": running_reports,
                "draft_playbooks": draft_templates,
                "active_users": self._count(User, User.is_active.is_(True)),
            },
            "attention_items": self._attention_items(unmatched, integration_errors, failed_imports, failed_reports, draft_templates),
            "integration_summary": IntegrationSyncService(self.db).sources_summary(),
            "recent_activity": [self._activity(event) for event in self.db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(8))],
            "recent_jobs": self._recent_jobs(),
            "system_status": PlatformStatusService(self.db).summary(),
            "quick_actions": [
                {"label": "Обработать fixture", "path": "/management?tab=integrations"},
                {"label": "Открыть сопоставления", "path": "/management?tab=integrations"},
                {"label": "Назначить KAM организациям", "path": "/management?tab=assignments"},
                {"label": "Эталоны workflow", "path": "/management?tab=playbooks"},
                {"label": "Обращения по документации", "path": "/management?tab=documentation-requests"},
            ],
        }

    def _attention_items(self, unmatched: int, integration_errors: int, failed_imports: int, failed_reports: int, draft_templates: int) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        self._append_attention(items, unmatched, "P1", "сигналов не сопоставлены", "Интеграции", "Разобрать", "/management?tab=integrations", IntegrationSignal.received_at, IntegrationSignal.status == "unmatched")
        self._append_attention(items, integration_errors, "P1", "ошибок интеграций", "Интеграции", "Открыть diagnostics", "/management?tab=integrations", IntegrationSignal.received_at, IntegrationSignal.status == "error")
        self._append_attention(items, failed_imports, "P1", "импортов завершились с ошибкой", "Импорты", "Открыть управление", "/management", ImportJob.updated_at, ImportJob.status == "FAILED")
        self._append_attention(items, failed_reports, "WARNING", "отчётов завершились с ошибкой", "Отчёты", "Открыть отчёты", "/reports", ReportJob.updated_at, ReportJob.status == "FAILED")
        self._append_attention(items, draft_templates, "INFO", "шаблонов ожидают публикации", "Эталоны workflow", "Открыть шаблоны", "/management?tab=playbooks", WorkflowTemplate.updated_at, WorkflowTemplate.status == "draft")
        return items

    def _append_attention(self, items: list[dict[str, Any]], count: int, priority: str, suffix: str, source: str, action: str, path: str, date_column, condition) -> None:
        if not count:
            return
        occurred_at = self.db.scalar(select(func.max(date_column)).where(condition))
        items.append({"priority": priority, "event": f"{count} {suffix}", "source": source, "occurred_at": occurred_at.isoformat() if occurred_at else None, "action": action, "path": path})

    def _recent_jobs(self) -> list[dict[str, Any]]:
        imports = self.db.scalars(select(ImportJob).order_by(ImportJob.updated_at.desc()).limit(3)).all()
        reports = self.db.scalars(select(ReportJob).order_by(ReportJob.updated_at.desc()).limit(3)).all()
        jobs = [
            {"id": str(job.id), "kind": "Импорт", "status": job.status, "occurred_at": job.updated_at.isoformat(), "reason": job.error_code or "Без ошибок"}
            for job in imports
        ] + [
            {"id": str(job.id), "kind": "Отчёт", "status": job.status, "occurred_at": job.updated_at.isoformat(), "reason": job.error_code or "Без ошибок"}
            for job in reports
        ]
        return sorted(jobs, key=lambda item: item["occurred_at"], reverse=True)[:5]

    def _activity(self, event: AuditEvent) -> dict[str, Any]:
        metadata = event.event_metadata or {}
        details = self._activity_details(event, metadata)
        return {"id": str(event.id), "title": AUDIT_ACTION_LABELS.get(event.action, event.action.replace(".", " · ")), "details": details, "result": event.result, "occurred_at": event.created_at.isoformat()}

    @staticmethod
    def _activity_details(event: AuditEvent, metadata: dict[str, Any]) -> str | None:
        if source := metadata.get("source"):
            return f"Источник: {source}"
        if report_format := metadata.get("format"):
            return f"Формат: {report_format}"
        if event.error_code:
            return f"Код: {event.error_code}"
        return event.reason

    def _count(self, model, condition) -> int:
        return self.db.scalar(select(func.count()).select_from(model).where(condition)) or 0

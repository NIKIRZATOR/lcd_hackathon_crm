import json
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.health.service import HealthService
from app.modules.integrations.model import IntegrationSignal, ProgramMetric
from app.modules.nba.service import NbaService
from app.modules.organizations.model import Organization
from app.modules.products.model import ITProduct
from app.modules.program_instances.model import ProgramInstance


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "program_signals.json"


class IntegrationSyncService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def metrics(self, program_id: UUID) -> ProgramMetric | None:
        return self.db.scalar(
            select(ProgramMetric).where(ProgramMetric.program_instance_id == program_id)
        )

    def sync_program(self, program_id: UUID) -> dict[str, object]:
        program = self.db.get(ProgramInstance, program_id)
        if program is None:
            raise ValueError("Program not found")
        organization = self.db.get(Organization, program.organization_id)
        product = self.db.get(ITProduct, program.product_id)
        assert organization is not None and product is not None
        metric = self.metrics(program.id)
        if metric is None:
            metric = ProgramMetric(program_instance_id=program.id)
            self.db.add(metric)
            self.db.flush()
        counts = {"mapped": 0, "unmatched": 0, "errors": 0}
        for signal in self._fixture_signals():
            match = signal.get("match", {})
            if match.get("organization_name") != organization.name:
                continue
            if match.get("product_name") not in {product.name, "Unknown Product"}:
                continue
            status = signal["status"]
            is_mapped = status == "mapped" and match.get("product_name") == product.name
            stored_status = "mapped" if is_mapped else status
            stored_program_id = program.id if is_mapped or status == "error" else None
            self.db.add(
                IntegrationSignal(
                    source=signal["source"],
                    status=stored_status,
                    organization_id=organization.id,
                    program_instance_id=stored_program_id,
                    payload=signal.get("payload", {}),
                    error_message=signal.get("error_message"),
                )
            )
            if stored_status == "mapped":
                self._apply_metric(metric, signal["payload"])
                counts["mapped"] += 1
            elif stored_status == "unmatched":
                counts["unmatched"] += 1
            else:
                counts["errors"] += 1
        metric.synced_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(metric)
        HealthService(self.db).recompute(program.id)
        NbaService(self.db).recompute_program(program.id)
        return {**counts, "metrics": metric}

    @staticmethod
    def _apply_metric(metric: ProgramMetric, payload: dict) -> None:
        if "applications_count" in payload:
            metric.applications_count = int(payload["applications_count"])
        if "students_count" in payload:
            metric.students_count = int(payload["students_count"])
        if "streams_count" in payload:
            metric.streams_count = int(payload["streams_count"])
        if payload.get("teacher_activity_on"):
            metric.teacher_activity_on = date.fromisoformat(payload["teacher_activity_on"])

    @staticmethod
    def _fixture_signals() -> list[dict]:
        return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))["signals"]

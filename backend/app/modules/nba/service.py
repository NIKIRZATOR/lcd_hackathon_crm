from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.modules.licenses.model import License
from app.modules.nba.model import NbaItem, NbaRule
from app.modules.organizations.model import Organization
from app.modules.organizations.service import OrganizationService
from app.modules.products.model import ITProduct
from app.modules.program_instances.model import AcademicWindow, ProgramInstance
from app.modules.teachers.model import TeacherCarrier
from app.modules.users.model import User
from app.modules.workflows.model import (
    WorkflowStage,
    WorkflowStageInstance,
    WorkflowTransition,
)


RULES = {
    "stage_overdue": "Просрочен этап",
    "semester_window": "Срок учебного окна",
    "license_expiring": "Истекает лицензия",
    "lms_silence": "Нет активности в LMS",
    "no_teacher": "Нет преподавателя-носителя",
    "demand_without_program": "Спрос без программы",
    "next_stage": "Следующий этап",
}


class NbaService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def recompute_program(self, program_id: UUID) -> list[NbaItem]:
        program = self.db.get(ProgramInstance, program_id)
        if program is None:
            return []
        rules = self._rules()
        entity_key = f"program:{program.id}"
        candidates: dict[str, tuple[str, str, datetime | None]] = {}
        now = datetime.now(timezone.utc)
        current = (
            self.db.get(WorkflowStageInstance, program.current_stage_instance_id)
            if program.current_stage_instance_id
            else None
        )
        if current and current.due_at and current.due_at < now:
            candidates["stage_overdue"] = (
                "critical",
                "Срок текущего этапа истёк.",
                current.due_at,
            )
        if program.academic_window_id:
            window = self.db.get(AcademicWindow, program.academic_window_id)
            if (
                window
                and 0 <= (window.plan_cutoff_on - date.today()).days <= 21
                and program.current_stage_code != "classes_running"
            ):
                candidates["semester_window"] = (
                    "high",
                    "До контрольной даты учебного окна осталось не более 21 дня.",
                    datetime.combine(window.plan_cutoff_on, datetime.min.time(), timezone.utc),
                )
        licenses = list(
            self.db.scalars(
                select(License).where(License.program_instance_id == program.id)
            ).all()
        )
        expiring = [
            item
            for item in licenses
            if item.valid_until
            and (item.valid_until.date() - date.today()).days <= 90
        ]
        if expiring:
            due_at = min(item.valid_until for item in expiring if item.valid_until)
            candidates["license_expiring"] = (
                "high",
                "Лицензия истекает или уже истекла.",
                due_at,
            )
        teacher = self.db.scalar(
            select(TeacherCarrier).where(
                TeacherCarrier.program_instance_id == program.id,
                TeacherCarrier.status == "active",
            )
        )
        if teacher is None:
            candidates["no_teacher"] = (
                "high",
                "Для программы нет активного преподавателя-носителя.",
                None,
            )
        elif (
            teacher.last_lms_activity_on is None
            or date.today() - teacher.last_lms_activity_on > timedelta(days=30)
        ):
            candidates["lms_silence"] = (
                "medium",
                "Нет актуальной активности преподавателя в LMS.",
                None,
            )
        if current and program.status == "active":
            next_stage = self.db.scalar(
                select(WorkflowStage.name)
                .join(
                    WorkflowTransition,
                    WorkflowTransition.to_stage_id == WorkflowStage.id,
                )
                .where(
                    WorkflowTransition.workflow_version_id == program.workflow_version_id,
                    WorkflowTransition.from_stage_id == current.workflow_stage_id,
                )
                .order_by(WorkflowTransition.created_at)
            )
            if next_stage:
                candidates["next_stage"] = (
                    "low",
                    f"Подготовьте переход к этапу «{next_stage}».",
                    current.due_at,
                )
        active_codes = set(candidates) if program.status == "active" else set()
        for code, (severity, reason, due_at) in candidates.items():
            self._upsert(
                rules[code],
                program,
                entity_key,
                severity,
                reason,
                due_at,
            )
        existing = self.db.scalars(
            select(NbaItem)
            .join(NbaRule)
            .where(NbaItem.entity_key == entity_key, NbaItem.status == "active")
        ).all()
        for item in existing:
            rule = self.db.get(NbaRule, item.rule_id)
            if rule and rule.code not in active_codes:
                item.status = "resolved"
                item.resolved_at = now
        self.db.flush()
        return list(
            self.db.scalars(
                select(NbaItem).where(NbaItem.entity_key == entity_key, NbaItem.status == "active")
            ).all()
        )

    def today(self, user: User):
        severity_order = case(
            (NbaItem.severity == "critical", 0),
            (NbaItem.severity == "high", 1),
            (NbaItem.severity == "medium", 2),
            else_=3,
        )
        rows = self.db.execute(
            select(NbaItem, NbaRule.code, Organization.name, ITProduct.name)
            .join(NbaRule, NbaRule.id == NbaItem.rule_id)
            .join(Organization, Organization.id == NbaItem.organization_id)
            .outerjoin(ITProduct, ITProduct.id == NbaItem.product_id)
            .where(NbaItem.status == "active")
            .order_by(severity_order, NbaItem.due_at.nulls_last(), NbaItem.created_at)
        ).all()
        result = []
        for item, rule_code, organization_name, product_name in rows:
            try:
                OrganizationService(self.db).get(item.organization_id, user)
            except HTTPException as error:
                if error.status_code == 403:
                    continue
                raise
            result.append(
                {
                    "id": item.id,
                    "rule_code": rule_code,
                    "severity": item.severity,
                    "organization_id": item.organization_id,
                    "organization_name": organization_name,
                    "program_instance_id": item.program_instance_id,
                    "product_name": product_name,
                    "reason": item.reason,
                    "action": item.action,
                    "due_at": item.due_at,
                }
            )
        return result

    def _rules(self) -> dict[str, NbaRule]:
        existing = {
            rule.code: rule
            for rule in self.db.scalars(
                select(NbaRule).where(NbaRule.code.in_(RULES))
            ).all()
        }
        for code, name in RULES.items():
            if code not in existing:
                existing[code] = NbaRule(code=code, name=name)
                self.db.add(existing[code])
        self.db.flush()
        return existing

    def _upsert(
        self,
        rule: NbaRule,
        program: ProgramInstance,
        entity_key: str,
        severity: str,
        reason: str,
        due_at: datetime | None,
    ) -> None:
        item = self.db.scalar(
            select(NbaItem).where(
                NbaItem.rule_id == rule.id, NbaItem.entity_key == entity_key
            )
        )
        if item is None:
            item = NbaItem(
                rule_id=rule.id,
                organization_id=program.organization_id,
                program_instance_id=program.id,
                product_id=program.product_id,
                entity_key=entity_key,
                severity=severity,
                reason=reason,
                action="Открыть программу",
                due_at=due_at,
                status="active",
            )
            self.db.add(item)
            return
        item.severity = severity
        item.reason = reason
        item.due_at = due_at
        item.status = "active"
        item.resolved_at = None

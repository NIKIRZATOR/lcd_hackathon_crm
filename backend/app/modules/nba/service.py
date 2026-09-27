from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.modules.licenses.model import License
from app.modules.integrations.model import IntegrationSignal
from app.modules.checklists.model import PlaybookChecklistItem, ProgramChecklistValue
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
    "stage_overdue_8_plus": "Крупная просрочка этапа",
    "license_expired": "Лицензия истекла",
    "teacher_left": "Преподаватель ушёл",
    "semester_window": "Срок учебного окна",
    "license_expiring": "Истекает лицензия",
    "lms_silence": "Нет активности в LMS",
    "no_teacher": "Нет преподавателя-носителя",
    "demand_without_program": "Спрос без программы",
    "organization_without_program": "Площадка без программы",
    "integration_unmatched": "Несопоставленный сигнал интеграции",
    "missing_stage_fact": "Не заполнен обязательный факт этапа",
    "close_stage": "Этап готов к закрытию",
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
                "high",
                "Срок текущего этапа истёк.",
                current.due_at,
            )
            if (now.date() - current.due_at.date()).days >= 8:
                candidates["stage_overdue_8_plus"] = ("critical", "Текущий этап просрочен более чем на неделю.", current.due_at)
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
        if any(item.valid_until and item.valid_until.date() < date.today() for item in licenses):
            candidates["license_expired"] = ("critical", "Срок действия лицензии истёк.", min(item.valid_until for item in licenses if item.valid_until and item.valid_until.date() < date.today()))
        teacher = self.db.scalar(
            select(TeacherCarrier)
            .where(TeacherCarrier.program_instance_id == program.id)
            .order_by(TeacherCarrier.updated_at.desc())
        )
        if teacher is None:
            candidates["no_teacher"] = (
                "high",
                "Для программы нет активного преподавателя-носителя.",
                None,
            )
        elif teacher.status == "left":
            candidates["teacher_left"] = ("critical", "Преподаватель-носитель ушёл из программы.", None)
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
            missing_facts = self.db.execute(
                select(PlaybookChecklistItem)
                .join(ProgramChecklistValue, ProgramChecklistValue.checklist_item_id == PlaybookChecklistItem.id)
                .where(
                    ProgramChecklistValue.stage_instance_id == current.id,
                    PlaybookChecklistItem.required.is_(True),
                    ProgramChecklistValue.is_done.is_(False),
                )
                .order_by(PlaybookChecklistItem.created_at)
            ).scalars().all()
            if missing_facts:
                fact = missing_facts[0]
                target = "attachments" if fact.item_type == "file" else "stakeholder" if fact.item_type == "stakeholder_role" else "date" if fact.item_type == "date" else "checklist"
                candidates["missing_stage_fact"] = ("high", f"Заполните обязательный факт: {fact.label}", current.due_at, target)
            else:
                candidates["close_stage"] = ("medium", "Все обязательные факты собраны — этап можно закрыть.", current.due_at, "close_stage")
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
        if self.db.scalar(
            select(IntegrationSignal.id)
            .where(IntegrationSignal.program_instance_id == program.id, IntegrationSignal.status == "unmatched")
            .limit(1)
        ):
            candidates["integration_unmatched"] = ("high", "Есть несопоставленный сигнал интеграции.", None)
        active_codes = set(candidates) if program.status == "active" else set()
        for code, candidate in candidates.items():
            severity, reason, due_at, *target = candidate
            self._upsert(
                rules[code],
                program,
                entity_key,
                severity,
                reason,
                due_at,
                target[0] if target else "program",
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
        self._recompute_organization_rules()
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
                    "priority": item.priority,
                    "action_target": item.action_target,
                    "due_at": item.due_at,
                }
            )
        return result

    def _recompute_organization_rules(self) -> None:
        rules = self._rules()
        for organization in self.db.scalars(select(Organization)).all():
            live = self.db.scalar(select(ProgramInstance.id).where(ProgramInstance.organization_id == organization.id, ProgramInstance.status.in_(["draft", "active", "paused"])).limit(1))
            demand = self.db.scalar(select(IntegrationSignal.id).where(IntegrationSignal.organization_id == organization.id, IntegrationSignal.program_instance_id.is_(None), IntegrationSignal.source.in_(("WEBSITE", "website"))).limit(1))
            for code, present, reason in (("organization_without_program", live is None, "У площадки нет активной программы."), ("demand_without_program", demand is not None and live is None, "Есть спрос с сайта без запущенной программы.")):
                entity_key = f"organization:{organization.id}:{code}"
                item = self.db.scalar(select(NbaItem).where(NbaItem.rule_id == rules[code].id, NbaItem.entity_key == entity_key))
                if present:
                    if item is None:
                        item = NbaItem(rule_id=rules[code].id, organization_id=organization.id, program_instance_id=None, product_id=None, entity_key=entity_key, severity="medium", reason=reason, action="Открыть вуз / + программа" if code == "demand_without_program" else "Открыть площадку", priority="P4" if code == "demand_without_program" else "P3", action_target="organization", due_at=None, status="active")
                        self.db.add(item)
                    else:
                        item.status, item.reason, item.resolved_at = "active", reason, None
                elif item is not None and item.status == "active":
                    item.status = "resolved"
                    item.resolved_at = datetime.now(timezone.utc)

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
        action_target: str,
    ) -> None:
        action = "Закрыть этап" if rule.code == "close_stage" else "Заполнить факт" if rule.code == "missing_stage_fact" else "Открыть программу"
        priority = "P2" if rule.code == "close_stage" else {"critical": "P0", "high": "P1", "medium": "P3", "low": "P4"}[severity]
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
                action=action,
                priority=priority,
                action_target=action_target,
                due_at=due_at,
                status="active",
            )
            self.db.add(item)
            return
        item.severity = severity
        item.action = action
        item.priority = priority
        item.action_target = action_target
        item.reason = reason
        item.due_at = due_at
        item.status = "active"
        item.resolved_at = None

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.health.service import HealthService
from app.modules.nba.service import NbaService
from app.modules.auth.access import get_subordinate_kam_ids, has_any_role, is_admin
from app.modules.checklists.model import PlaybookChecklistItem
from app.modules.organizations.model import OrgAssignment, OrganizationType
from app.modules.organizations.service import OrganizationService
from app.modules.products.model import ITProduct, ProgramProduct
from app.modules.program_instances.model import AcademicWindow, ProgramInstance
from app.modules.program_instances.schemas import ProgramInstanceRead, WorkflowJournalRead
from app.modules.programs.model import ITDirection
from app.modules.users.model import User
from app.modules.programs.model import ITProgram
from app.modules.workflows.model import WorkflowTemplate, WorkflowTransition, WorkflowVersion
from app.modules.workflows.service import WorkflowRuntimeService
from app.modules.workflows.model import WorkflowStageInstance, WorkflowStage
from app.modules.workflow_catalog.model import WorkflowPhase, WorkflowStageCatalog
from app.modules.organizations.model import Organization
from app.modules.integrations.model import ProgramMetric
from app.modules.licenses.model import Contract, License
from app.modules.teachers.model import TeacherCarrier
from app.modules.program_instances.schemas import ProgramInstanceStart


class ProgramInstanceService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_organization(
        self, organization_id: UUID, current_user: User, limit: int, offset: int
    ) -> tuple[list[ProgramInstanceRead], int]:
        OrganizationService(self.db).get(organization_id, current_user)
        self._recompute_missing_health(organization_id)
        statement = self._statement().where(
            ProgramInstance.organization_id == organization_id
        )
        total = (
            self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0
        )
        rows = self.db.execute(
            statement.order_by(ITDirection.name, ITProduct.name)
            .limit(limit)
            .offset(offset)
        ).all()
        return [self._read(row) for row in rows], total

    def get(self, program_instance_id: UUID, current_user: User) -> ProgramInstanceRead:
        statement = self._statement().where(ProgramInstance.id == program_instance_id)
        row = self.db.execute(statement).first()
        if row is None:
            raise HTTPException(status_code=404, detail="Program instance not found")
        OrganizationService(self.db).get(
            row.ProgramInstance.organization_id, current_user
        )
        return self._read(row)

    def start(
        self, organization_id: UUID, payload: ProgramInstanceStart, current_user: User
    ) -> ProgramInstanceRead:
        organization = OrganizationService(self.db).get(organization_id, current_user)
        if organization.status == "archived":
            raise HTTPException(status_code=409, detail="Archived organization cannot start a program")
        template = self.db.get(WorkflowTemplate, payload.playbook_template_id)
        if template is None or template.status != "published" or not template.is_active:
            raise HTTPException(
                status_code=422, detail="Published playbook is required"
            )
        organization_type = self.db.get(OrganizationType, organization.type_id)
        if organization_type is None or not self._template_applies(template, organization_type.code):
            raise HTTPException(status_code=422, detail="Playbook is not applicable to organization type")
        self._validate_playbook_choice(
            template, organization_id, organization_type.code, payload
        )
        compatible_program = self.db.scalar(
            select(ITProgram)
            .join(ProgramProduct, ProgramProduct.program_id == ITProgram.id)
            .where(
                ITProgram.direction_id == payload.direction_id,
                ITProgram.is_active.is_(True),
                ProgramProduct.product_id == payload.product_id,
            )
        )
        product = self.db.get(ITProduct, payload.product_id)
        if compatible_program is None or product is None or not product.is_active:
            raise HTTPException(
                status_code=422, detail="Direction and product are not compatible"
            )
        effective_kam_id = self._resolve_kam(organization_id, payload.kam_user_id, current_user)
        existing = self.db.scalar(
            select(ProgramInstance).where(
                ProgramInstance.organization_id == organization_id,
                ProgramInstance.direction_id == payload.direction_id,
                ProgramInstance.product_id == payload.product_id,
                ProgramInstance.parent_program_id.is_(None),
                ProgramInstance.status.not_in(["completed", "cancelled"]),
            )
        )
        if existing is not None:
            raise HTTPException(status_code=409, detail="Active program already exists")
        program = ProgramInstance(
            organization_id=organization_id,
            direction_id=payload.direction_id,
            product_id=payload.product_id,
            kam_user_id=effective_kam_id,
            playbook_template_id=template.id,
            template_snapshot=self._template_snapshot(template),
            status="active",
            academic_window_id=payload.academic_window_id,
            health_band="green",
            comment=payload.comment,
            parent_program_id=payload.parent_program_id,
        )
        try:
            self.db.add(program)
            self.db.flush()
            WorkflowRuntimeService(self.db).initialize_program_workflow(
                program, responsible_user_id=effective_kam_id
            )
            HealthService(self.db).recompute(program.id)
            NbaService(self.db).recompute_program(program.id)
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            constraint_name = getattr(
                getattr(exc.orig, "diag", None), "constraint_name", None
            )
            if constraint_name == "uq_program_instances_active_scope":
                raise HTTPException(
                    status_code=409, detail="Active program already exists"
                ) from exc
            raise
        return self.get(program.id, current_user)

    def available_playbooks(
        self,
        organization_id: UUID,
        current_user: User,
        direction_id: UUID | None = None,
        product_id: UUID | None = None,
        parent_program_id: UUID | None = None,
    ) -> list[dict[str, object]]:
        organization = OrganizationService(self.db).get(organization_id, current_user)
        organization_type = self.db.get(OrganizationType, organization.type_id)
        type_code = organization_type.code if organization_type else ""
        has_signed_contract = bool(
            self.db.scalar(
                select(Contract.id).where(
                    Contract.organization_id == organization_id,
                    (Contract.signed_on.is_not(None)) | (Contract.signed_at.is_not(None)),
                )
            )
        )
        parent = self.db.get(ProgramInstance, parent_program_id) if parent_program_id else None
        recommended_code = (
            "teacher_replace" if parent and parent.status in {"draft", "active", "paused"}
            else "license_renewal" if parent and self._license_expires_soon(parent.id)
            else "school_short" if type_code == "school"
            else "expansion" if has_signed_contract else "full_cycle"
        )
        templates = self.db.scalars(
            select(WorkflowTemplate)
            .where(
                WorkflowTemplate.status == "published",
                WorkflowTemplate.is_active.is_(True),
            )
            .order_by(WorkflowTemplate.name)
        ).all()
        result = []
        for template in templates:
            reason = self._playbook_unavailable_reason(
                template, organization_id, type_code, direction_id, product_id, parent
            )
            result.append({
                "id": template.id,
                "code": template.code,
                "name": template.name,
                "applies_to_type": template.applies_to_type,
                "recommended": template.code == recommended_code,
                "disabled": reason is not None,
                "reason": reason,
            })
        return result

    def _validate_playbook_choice(
        self,
        template: WorkflowTemplate,
        organization_id: UUID,
        organization_type: str,
        payload: ProgramInstanceStart,
    ) -> None:
        parent = self.db.get(ProgramInstance, payload.parent_program_id) if payload.parent_program_id else None
        reason = self._playbook_unavailable_reason(
            template, organization_id, organization_type, payload.direction_id, payload.product_id, parent
        )
        if reason:
            raise HTTPException(status_code=422, detail=reason)

    def _playbook_unavailable_reason(
        self,
        template: WorkflowTemplate,
        organization_id: UUID,
        organization_type: str,
        direction_id: UUID | None,
        product_id: UUID | None,
        parent: ProgramInstance | None,
    ) -> str | None:
        if not self._template_applies(template, organization_type):
            return "Playbook is not applicable to this organization type"
        has_signed_contract = bool(self.db.scalar(select(Contract.id).where(
            Contract.organization_id == organization_id,
            (Contract.signed_on.is_not(None)) | (Contract.signed_at.is_not(None)),
        )))
        if template.code == "full_cycle" and has_signed_contract:
            return "Full cycle is available only without an active framework contract"
        if template.code == "expansion" and not has_signed_contract:
            return "Expansion requires an active framework contract"
        if template.code in {"license_renewal", "teacher_replace"}:
            if parent is None:
                return "This playbook must be started from a parent program"
            if (parent.organization_id, parent.direction_id, parent.product_id) != (organization_id, direction_id, product_id):
                return "Parent program must match organization, direction and product"
            if template.code == "license_renewal" and not self._license_expires_soon(parent.id):
                return "License renewal requires a parent license expiring within 90 days"
            if template.code == "teacher_replace" and parent.status not in {"draft", "active", "paused"}:
                return "Teacher replacement requires a live parent program"
        return None

    def _license_expires_soon(self, program_id: UUID) -> bool:
        today = date.today()
        return bool(self.db.scalar(select(License.id).where(
            License.program_instance_id == program_id,
            License.valid_until.is_not(None),
            License.valid_until >= today,
            License.valid_until <= today + timedelta(days=90),
        )))

    @staticmethod
    def _template_applies(template: WorkflowTemplate, type_code: str) -> bool:
        if template.code == "full_cycle":
            return type_code in {"university", "spo"}
        return template.applies_to_type in {"all", type_code}

    def _resolve_kam(self, organization_id: UUID, selected_kam_id: UUID | None, current_user: User) -> UUID:
        assignment_kam_id = self.db.scalar(
            select(OrgAssignment.user_id).where(
                OrgAssignment.organization_id == organization_id,
                OrgAssignment.status == "active",
            )
        )
        if has_any_role(current_user, "KAM") and not (is_admin(current_user) or has_any_role(current_user, "MANAGER")):
            if selected_kam_id not in {None, current_user.id} or assignment_kam_id != current_user.id:
                raise HTTPException(status_code=403, detail="KAM can start programs only in own portfolio")
            return current_user.id
        if selected_kam_id is None:
            if assignment_kam_id is None:
                raise HTTPException(status_code=422, detail="Organization has no active KAM assignment")
            return assignment_kam_id
        selected = self.db.get(User, selected_kam_id)
        if selected is None or not selected.is_active or not has_any_role(selected, "KAM"):
            raise HTTPException(status_code=422, detail="Active KAM is required")
        if not is_admin(current_user) and selected_kam_id not in get_subordinate_kam_ids(self.db, current_user.id):
            raise HTTPException(status_code=403, detail="KAM is outside manager scope")
        return selected_kam_id

    def _template_snapshot(self, template: WorkflowTemplate) -> dict[str, object]:
        version = self.db.scalar(
            select(WorkflowVersion)
            .where(
                WorkflowVersion.workflow_template_id == template.id,
                WorkflowVersion.status == "PUBLISHED",
            )
            .order_by(WorkflowVersion.version.desc())
        )
        if version is None:
            raise HTTPException(status_code=422, detail="Published playbook version is required")
        stages = list(
            self.db.scalars(
                select(WorkflowStage)
                .where(WorkflowStage.workflow_version_id == version.id, WorkflowStage.is_active.is_(True))
                .order_by(WorkflowStage.order_index)
            ).all()
        )
        transitions = list(self.db.scalars(select(WorkflowTransition).where(WorkflowTransition.workflow_version_id == version.id)).all())
        checklist = list(
            self.db.scalars(
                select(PlaybookChecklistItem).where(
                    PlaybookChecklistItem.workflow_stage_id.in_([stage.id for stage in stages])
                )
            ).all()
        ) if stages else []
        catalog_details = {
            catalog.id: {
                "code": catalog.code,
                "phase_code": phase.code,
                "phase_name": phase.name,
                "phase_order": phase.sort_order,
            }
            for catalog, phase in self.db.execute(
                select(WorkflowStageCatalog, WorkflowPhase)
                .join(WorkflowPhase, WorkflowPhase.id == WorkflowStageCatalog.default_phase_id)
                .where(
                    WorkflowStageCatalog.id.in_([stage.stage_catalog_id for stage in stages if stage.stage_catalog_id])
                )
            ).all()
        }
        phases = {
            (details["phase_code"], details["phase_name"], details["phase_order"])
            for details in catalog_details.values()
        }
        return {
            "playbook": {"code": template.code, "name": template.name, "version": version.version},
            "phases": [
                {"code": code, "name": name, "order": order}
                for code, name, order in sorted(phases, key=lambda item: item[2])
            ],
            "stages": [
                {
                    "id": str(stage.id),
                    "code": catalog_details.get(stage.stage_catalog_id, {}).get("code", stage.name),
                    "name": stage.name, "order": stage.order_index,
                    "sla_days": stage.default_duration_days, "optional": stage.is_optional,
                    "semester_critical": stage.semester_critical,
                    "phase_code": catalog_details.get(stage.stage_catalog_id, {}).get("phase_code"),
                    "phase_name": catalog_details.get(stage.stage_catalog_id, {}).get("phase_name"),
                }
                for stage in stages
            ],
            "checklist": [
                {"stage_id": str(item.workflow_stage_id), "code": item.code, "label": item.label,
                 "item_type": item.item_type, "required": item.required,
                 "required_stakeholder_role": item.required_stakeholder_role}
                for item in checklist
            ],
            "transitions": [
                {"from_stage_id": str(item.from_stage_id), "to_stage_id": str(item.to_stage_id),
                 "name": item.name, "condition_code": item.condition_code}
                for item in transitions
            ],
        }

    def health_summary(
        self, organization_id: UUID, current_user: User
    ) -> dict[str, object]:
        OrganizationService(self.db).get(organization_id, current_user)
        programs = list(
            self.db.scalars(
                select(ProgramInstance)
                .where(
                    ProgramInstance.organization_id == organization_id,
                    ProgramInstance.status == "active",
                )
                .order_by(ProgramInstance.health_score.asc().nullsfirst())
            ).all()
        )
        for program in programs:
            HealthService(self.db).recompute(program.id)
        self.db.commit()
        programs.sort(key=lambda program: program.health_score or 0)
        worst = programs[0] if programs else None
        return {
            "organization_id": organization_id,
            "active_programs_count": len(programs),
            "worst_health_score": worst.health_score if worst else None,
            "worst_health_band": worst.health_band if worst else None,
            "worst_program_instance_id": worst.id if worst else None,
        }

    def workflow_journal(self, current_user: User, preset: str) -> list[WorkflowJournalRead]:
        statement = (
            select(ProgramInstance, Organization.name, ITDirection.name, ITProduct.name, WorkflowTemplate.name, WorkflowStage.name, User.full_name, WorkflowStageInstance.due_at, ProgramMetric.students_count, ProgramMetric.applications_count)
            .join(Organization, Organization.id == ProgramInstance.organization_id)
            .join(ITDirection, ITDirection.id == ProgramInstance.direction_id)
            .join(ITProduct, ITProduct.id == ProgramInstance.product_id)
            .join(WorkflowTemplate, WorkflowTemplate.id == ProgramInstance.playbook_template_id)
            .outerjoin(WorkflowStageInstance, WorkflowStageInstance.id == ProgramInstance.current_stage_instance_id)
            .outerjoin(WorkflowStage, WorkflowStage.id == WorkflowStageInstance.workflow_stage_id)
            .outerjoin(User, User.id == ProgramInstance.kam_user_id)
            .outerjoin(ProgramMetric, ProgramMetric.program_instance_id == ProgramInstance.id)
        )
        rows = self.db.execute(statement).all()
        result = []
        now = datetime.now(timezone.utc)
        for program, org_name, direction_name, product_name, playbook_name, stage_name, kam_name, due_at, students, applications in rows:
            try:
                OrganizationService(self.db).get(program.organization_id, current_user)
            except HTTPException as error:
                if error.status_code == 403:
                    continue
                raise
            if preset == "overdue" and not (due_at and due_at < now):
                continue
            if preset == "renewal":
                license_record = self.db.scalar(select(License).where(License.program_instance_id == program.id, License.valid_until.is_not(None)))
                if not license_record or (license_record.valid_until.date() - date.today()).days > 90:
                    continue
            if preset == "lms_silence":
                teacher = self.db.scalar(select(TeacherCarrier).where(TeacherCarrier.program_instance_id == program.id, TeacherCarrier.status == "active"))
                if teacher and teacher.last_lms_activity_on and (date.today() - teacher.last_lms_activity_on).days <= 30:
                    continue
            if preset == "semester" and not (program.academic_window_id and (window := self.db.get(AcademicWindow, program.academic_window_id)) and 0 <= (window.plan_cutoff_on - date.today()).days <= 21):
                continue
            result.append(WorkflowJournalRead(id=program.id, organization_name=org_name, direction_name=direction_name, product_name=product_name, playbook_name=playbook_name, current_stage_name=stage_name, due_at=due_at, health_score=program.health_score, health_band=program.health_band, kam_name=kam_name, students_count=students, applications_count=applications))
        return result

    def _recompute_missing_health(self, organization_id: UUID) -> None:
        program_ids = self.db.scalars(
            select(ProgramInstance.id).where(
                ProgramInstance.organization_id == organization_id,
                ProgramInstance.health_score.is_(None),
            )
        ).all()
        for program_id in program_ids:
            HealthService(self.db).recompute(program_id)
        if program_ids:
            self.db.commit()

    def _statement(self):
        return (
            select(
                ProgramInstance,
                ITDirection.name.label("direction_name"),
                ITProduct.name.label("product_name"),
                User.full_name.label("kam_name"),
                AcademicWindow.title.label("academic_window_title"),
                WorkflowTemplate.name.label("playbook_name"),
                WorkflowTemplate.code.label("playbook_code"),
            )
            .join(ITDirection, ITDirection.id == ProgramInstance.direction_id)
            .join(ITProduct, ITProduct.id == ProgramInstance.product_id)
            .outerjoin(User, User.id == ProgramInstance.kam_user_id)
            .outerjoin(
                AcademicWindow, AcademicWindow.id == ProgramInstance.academic_window_id
            )
            .join(WorkflowTemplate, WorkflowTemplate.id == ProgramInstance.playbook_template_id)
        )

    @staticmethod
    def _read(row) -> ProgramInstanceRead:
        program = row.ProgramInstance
        return ProgramInstanceRead(
            id=program.id,
            organization_id=program.organization_id,
            direction_id=program.direction_id,
            direction_name=row.direction_name,
            product_id=program.product_id,
            product_name=row.product_name,
            kam_user_id=program.kam_user_id,
            kam_name=row.kam_name,
            playbook_template_id=program.playbook_template_id,
            playbook_name=row.playbook_name,
            playbook_code=row.playbook_code,
            status=program.status,
            current_stage_code=program.current_stage_code,
            academic_window_id=program.academic_window_id,
            academic_window_title=row.academic_window_title,
            health_score=program.health_score,
            health_band=program.health_band,
            started_at=program.started_at,
            completed_at=program.completed_at,
            comment=program.comment,
            legacy_interaction_id=program.legacy_interaction_id,
        )

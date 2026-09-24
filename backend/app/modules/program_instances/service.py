from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.health.service import HealthService
from app.modules.nba.service import NbaService
from app.modules.organizations.service import OrganizationService
from app.modules.products.model import ITProduct
from app.modules.program_instances.model import AcademicWindow, ProgramInstance
from app.modules.program_instances.schemas import ProgramInstanceRead, WorkflowJournalRead
from app.modules.programs.model import ITDirection
from app.modules.users.model import User
from app.modules.programs.model import ITProgram
from app.modules.workflows.model import WorkflowTemplate
from app.modules.workflows.service import WorkflowRuntimeService
from app.modules.workflows.model import WorkflowStageInstance, WorkflowStage
from app.modules.organizations.model import Organization
from app.modules.integrations.model import ProgramMetric
from app.modules.licenses.model import License
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
        OrganizationService(self.db).get(organization_id, current_user)
        template = self.db.get(WorkflowTemplate, payload.playbook_template_id)
        if template is None or template.status != "published":
            raise HTTPException(
                status_code=422, detail="Published playbook is required"
            )
        legacy_program = self.db.scalar(
            select(ITProgram).where(ITProgram.direction_id == payload.direction_id)
        )
        if legacy_program is None or self.db.get(ITProduct, payload.product_id) is None:
            raise HTTPException(
                status_code=422, detail="Direction or product not found"
            )
        existing = self.db.scalar(
            select(ProgramInstance).where(
                ProgramInstance.organization_id == organization_id,
                ProgramInstance.direction_id == payload.direction_id,
                ProgramInstance.product_id == payload.product_id,
                ProgramInstance.status.not_in(["completed", "cancelled"]),
            )
        )
        if existing is not None:
            raise HTTPException(status_code=409, detail="Active program already exists")
        program = ProgramInstance(
            organization_id=organization_id,
            direction_id=payload.direction_id,
            product_id=payload.product_id,
            kam_user_id=current_user.id,
            playbook_template_id=template.id,
            template_snapshot={"playbook_code": template.code},
            status="active",
            academic_window_id=payload.academic_window_id,
            health_band="green",
            comment=payload.comment,
        )
        self.db.add(program)
        self.db.flush()
        WorkflowRuntimeService(self.db).initialize_program_workflow(program)
        HealthService(self.db).recompute(program.id)
        NbaService(self.db).recompute_program(program.id)
        return self.get(program.id, current_user)

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

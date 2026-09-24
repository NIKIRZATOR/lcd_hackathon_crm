from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.organizations.service import OrganizationService
from app.modules.products.model import ITProduct
from app.modules.program_instances.model import AcademicWindow, ProgramInstance
from app.modules.program_instances.schemas import ProgramInstanceRead
from app.modules.programs.model import ITDirection
from app.modules.users.model import User
from app.modules.interactions.model import UniversityInteraction
from app.modules.programs.model import ITProgram
from app.modules.workflows.model import WorkflowTemplate
from app.modules.workflows.service import WorkflowRuntimeService
from app.modules.program_instances.schemas import ProgramInstanceStart


class ProgramInstanceService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_organization(self, organization_id: UUID, current_user: User, limit: int, offset: int) -> tuple[list[ProgramInstanceRead], int]:
        OrganizationService(self.db).get(organization_id, current_user)
        statement = self._statement().where(ProgramInstance.organization_id == organization_id)
        total = self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0
        rows = self.db.execute(statement.order_by(ITDirection.name, ITProduct.name).limit(limit).offset(offset)).all()
        return [self._read(row) for row in rows], total

    def get(self, program_instance_id: UUID, current_user: User) -> ProgramInstanceRead:
        statement = self._statement().where(ProgramInstance.id == program_instance_id)
        row = self.db.execute(statement).first()
        if row is None:
            raise HTTPException(status_code=404, detail="Program instance not found")
        OrganizationService(self.db).get(row.ProgramInstance.organization_id, current_user)
        return self._read(row)

    def start(self, organization_id: UUID, payload: ProgramInstanceStart, current_user: User) -> ProgramInstanceRead:
        OrganizationService(self.db).get(organization_id, current_user)
        template = self.db.get(WorkflowTemplate, payload.playbook_template_id)
        if template is None or template.status != "published":
            raise HTTPException(status_code=422, detail="Published playbook is required")
        legacy_program = self.db.scalar(select(ITProgram).where(ITProgram.direction_id == payload.direction_id))
        if legacy_program is None or self.db.get(ITProduct, payload.product_id) is None:
            raise HTTPException(status_code=422, detail="Direction or product not found")
        existing = self.db.scalar(select(ProgramInstance).where(ProgramInstance.organization_id == organization_id, ProgramInstance.direction_id == payload.direction_id, ProgramInstance.product_id == payload.product_id, ProgramInstance.status.not_in(["completed", "cancelled"])))
        if existing is not None:
            raise HTTPException(status_code=409, detail="Active program already exists")
        interaction = UniversityInteraction(university_id=organization_id, program_id=legacy_program.id, product_id=payload.product_id, manager_user_id=current_user.id, workflow_template_id=template.id, status="ACTIVE", comment=payload.comment)
        self.db.add(interaction); self.db.flush()
        WorkflowRuntimeService(self.db).initialize_interaction_workflow(interaction)
        program = ProgramInstance(organization_id=organization_id, direction_id=payload.direction_id, product_id=payload.product_id, kam_user_id=current_user.id, playbook_template_id=template.id, template_snapshot={"playbook_code": template.code}, status="active", academic_window_id=payload.academic_window_id, health_band="green", current_stage_code="find_contact", comment=payload.comment, legacy_interaction_id=interaction.id)
        self.db.add(program)
        self.db.commit()
        return self.get(program.id, current_user)

    def _statement(self):
        return (
            select(ProgramInstance, ITDirection.name.label("direction_name"), ITProduct.name.label("product_name"), User.full_name.label("kam_name"), AcademicWindow.title.label("academic_window_title"))
            .join(ITDirection, ITDirection.id == ProgramInstance.direction_id)
            .join(ITProduct, ITProduct.id == ProgramInstance.product_id)
            .outerjoin(User, User.id == ProgramInstance.kam_user_id)
            .outerjoin(AcademicWindow, AcademicWindow.id == ProgramInstance.academic_window_id)
        )

    @staticmethod
    def _read(row) -> ProgramInstanceRead:
        program = row.ProgramInstance
        return ProgramInstanceRead(
            id=program.id, organization_id=program.organization_id, direction_id=program.direction_id,
            direction_name=row.direction_name, product_id=program.product_id, product_name=row.product_name,
            kam_user_id=program.kam_user_id, kam_name=row.kam_name, playbook_template_id=program.playbook_template_id,
            status=program.status, current_stage_code=program.current_stage_code,
            academic_window_id=program.academic_window_id, academic_window_title=row.academic_window_title,
            health_score=program.health_score, health_band=program.health_band, started_at=program.started_at,
            completed_at=program.completed_at, comment=program.comment, legacy_interaction_id=program.legacy_interaction_id,
        )

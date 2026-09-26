from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.licenses.model import License
from app.modules.integrations.model import ProgramMetric
from app.modules.program_instances.model import AcademicWindow, ProgramInstance
from app.modules.teachers.model import TeacherCarrier
from app.modules.workflows.model import WorkflowStageInstance


class HealthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def recompute(self, program_id: UUID) -> ProgramInstance:
        program = self.db.get(ProgramInstance, program_id)
        if program is None:
            raise ValueError("Program not found")
        score = 100
        now = datetime.now(timezone.utc)
        current = self.db.get(WorkflowStageInstance, program.current_stage_instance_id) if program.current_stage_instance_id else None
        if current and current.due_at and current.due_at < now:
            overdue_days = (now.date() - current.due_at.date()).days
            score -= 30 if overdue_days >= 8 else 15
        if program.academic_window_id:
            window = self.db.get(AcademicWindow, program.academic_window_id)
            if window and 0 <= (window.plan_cutoff_on - date.today()).days <= 21 and program.current_stage_code == "curriculum":
                score -= 10
        licenses = list(
            self.db.scalars(
                select(License).where(License.program_instance_id == program.id)
            ).all()
        )
        if any(license_record.valid_until and license_record.valid_until.date() < date.today() for license_record in licenses):
            score -= 25
        elif any(
            license_record.valid_until and 0 <= (license_record.valid_until.date() - date.today()).days <= 90
            for license_record in licenses
        ):
            score -= 10
        teacher = self.db.scalar(select(TeacherCarrier).where(TeacherCarrier.program_instance_id == program.id, TeacherCarrier.status == "active"))
        carrier_required = program.current_stage_code in {
            "train_teacher", "confirm_teacher", "curriculum", "start_classes", "classes_running", "period_results"
        }
        if teacher is None and carrier_required:
            score -= 15
        elif teacher is not None and teacher.status == "left" and program.current_stage_code in {"start_classes", "classes_running"}:
            score -= 25
        if teacher is not None and program.current_stage_code == "classes_running" and (
            teacher.last_lms_activity_on is None
            or (date.today() - teacher.last_lms_activity_on).days > 30
        ):
            score -= 15
        metrics = self.db.scalar(
            select(ProgramMetric).where(ProgramMetric.program_instance_id == program.id)
        )
        if (
            metrics is not None
            and program.current_stage_code == "classes_running"
            and metrics.students_count == 0
        ):
            score -= 15
        if (
            metrics is not None
            and metrics.applications_count > 0
            and metrics.students_count == 0
        ):
            score -= 10
        program.health_score = max(score, 0)
        program.health_band = "red" if score < 50 else "yellow" if score < 75 else "green"
        return program

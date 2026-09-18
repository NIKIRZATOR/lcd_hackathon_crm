from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import delete, update

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.database import SessionLocal
from app.modules.contacts.model import UniversityContact
from app.modules.documents.model import File
from app.modules.interactions.model import InteractionContact, UniversityInteraction
from app.modules.products.model import ITProduct, ProgramProduct, Vendor
from app.modules.programs.model import ITDirection, ITProgram
from app.modules.universities.model import University
from app.modules.users.model import User
from app.modules.workflows.model import (
    WorkflowStageAttachment,
    WorkflowStageComment,
    WorkflowStageInstance,
    WorkflowStage,
    WorkflowTemplate,
    WorkflowTransition,
    WorkflowTransitionHistory,
)


def main() -> None:
    db = SessionLocal()
    try:
        db.execute(delete(WorkflowStageAttachment))
        db.execute(delete(WorkflowStageComment))
        db.execute(delete(WorkflowTransitionHistory))
        db.execute(delete(InteractionContact))
        db.execute(update(UniversityInteraction).values(current_stage_instance_id=None))
        db.execute(delete(WorkflowStageInstance))
        db.execute(delete(WorkflowTransition))
        db.execute(delete(WorkflowStage))
        db.execute(delete(UniversityInteraction))
        db.execute(delete(ProgramProduct))
        db.execute(delete(UniversityContact))
        db.execute(delete(WorkflowTemplate))
        db.execute(delete(File))
        db.execute(delete(ITProduct))
        db.execute(delete(Vendor))
        db.execute(delete(ITProgram))
        db.execute(delete(ITDirection))
        db.execute(delete(University))
        db.execute(delete(User))

        db.commit()
    finally:
        db.close()

    print("V1 data cleared.")


if __name__ == "__main__":
    main()

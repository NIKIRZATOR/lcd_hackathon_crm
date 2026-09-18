"""Import all SQLAlchemy models so Alembic autogenerate can see metadata."""

from app.modules.contacts.model import UniversityContact
from app.modules.documents.model import File
from app.modules.interactions.model import InteractionContact, UniversityInteraction
from app.modules.products.model import ITProduct, ProgramProduct, Vendor
from app.modules.programs.model import ITDirection, ITProgram
from app.modules.universities.model import University
from app.modules.users.model import User
from app.modules.workflows.model import (
    WorkflowStage,
    WorkflowStageAttachment,
    WorkflowStageComment,
    WorkflowStageInstance,
    WorkflowTemplate,
    WorkflowTransition,
    WorkflowTransitionHistory,
)

__all__ = [
    "File",
    "ITDirection",
    "ITProduct",
    "ITProgram",
    "InteractionContact",
    "ProgramProduct",
    "University",
    "UniversityContact",
    "UniversityInteraction",
    "User",
    "Vendor",
    "WorkflowStage",
    "WorkflowStageAttachment",
    "WorkflowStageComment",
    "WorkflowStageInstance",
    "WorkflowTemplate",
    "WorkflowTransition",
    "WorkflowTransitionHistory",
]

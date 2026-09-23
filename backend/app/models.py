"""Import all SQLAlchemy models so Alembic autogenerate can see metadata."""

from app.modules.contacts.model import UniversityContact
from app.modules.audit.model import AuditEvent
from app.modules.documents.model import File
from app.modules.imports.model import ImportArtifact, ImportJob, ImportMapping, ImportMappingField, ImportRowError
from app.modules.interactions.model import InteractionContact, UniversityInteraction
from app.modules.licenses.model import Contract, License
from app.modules.products.model import ITProduct, ProgramProduct, Vendor
from app.modules.programs.model import ITDirection, ITProgram
from app.modules.universities.model import University
from app.modules.users.model import DataAccessScope, ManagerMembership, ResponsibleAssignmentHistory, Role, User, user_roles
from app.modules.workflows.model import (
    WorkflowChangeRequest,
    WorkflowMigrationJob,
    WorkflowStage,
    WorkflowStageAttachment,
    WorkflowStageComment,
    WorkflowStageInstance,
    WorkflowStageMapping,
    WorkflowTemplate,
    WorkflowTransition,
    WorkflowTransitionHistory,
    WorkflowVersion,
)

__all__ = [
    "File",
    "ImportArtifact",
    "ImportJob",
    "ImportMapping",
    "ImportMappingField",
    "ImportRowError",
    "AuditEvent",
    "ITDirection",
    "ITProduct",
    "ITProgram",
    "InteractionContact",
    "Contract",
    "DataAccessScope",
    "ManagerMembership",
    "ProgramProduct",
    "ResponsibleAssignmentHistory",
    "Role",
    "License",
    "University",
    "UniversityContact",
    "UniversityInteraction",
    "User",
    "user_roles",
    "Vendor",
    "WorkflowStage",
    "WorkflowStageAttachment",
    "WorkflowStageComment",
    "WorkflowStageInstance",
    "WorkflowStageMapping",
    "WorkflowTemplate",
    "WorkflowTransition",
    "WorkflowTransitionHistory",
    "WorkflowVersion",
    "WorkflowChangeRequest",
    "WorkflowMigrationJob",
]

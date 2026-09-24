"""Import all SQLAlchemy models so Alembic autogenerate can see metadata."""

from app.modules.contacts.model import UniversityContact
from app.modules.audit.model import AuditEvent
from app.modules.documents.model import File
from app.modules.imports.model import ImportArtifact, ImportJob, ImportMapping, ImportMappingField, ImportRowError
from app.modules.interactions.model import InteractionContact, UniversityInteraction
from app.modules.licenses.model import Contract, License
from app.modules.organizations.model import OrgAssignment, Organization, OrganizationType, Stakeholder
from app.modules.products.model import ITProduct, ProgramProduct, Vendor
from app.modules.program_instances.model import AcademicWindow, ProgramInstance
from app.modules.programs.model import ITDirection, ITProgram
from app.modules.reports.model import ReportArtifact, ReportJob
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
from app.modules.workflow_catalog.model import WorkflowPhase, WorkflowStageCatalog
from app.modules.checklists.model import PlaybookChecklistItem, ProgramChecklistValue

__all__ = [
    "File",
    "ImportArtifact",
    "ImportJob",
    "ImportMapping",
    "ImportMappingField",
    "ImportRowError",
    "AuditEvent",
    "AcademicWindow",
    "ITDirection",
    "ITProduct",
    "ITProgram",
    "InteractionContact",
    "Contract",
    "DataAccessScope",
    "ManagerMembership",
    "OrgAssignment",
    "Organization",
    "OrganizationType",
    "ProgramProduct",
    "ProgramInstance",
    "ResponsibleAssignmentHistory",
    "Role",
    "License",
    "ReportArtifact",
    "ReportJob",
    "University",
    "UniversityContact",
    "UniversityInteraction",
    "Stakeholder",
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
    "WorkflowPhase",
    "PlaybookChecklistItem",
    "ProgramChecklistValue",
    "WorkflowStageCatalog",
    "WorkflowMigrationJob",
]

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.core.database import engine

from app.modules.analytics.router import router as analytics_router
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.cohorts.router import router as cohorts_router
from app.modules.contacts.router import router as contacts_router
from app.modules.documents.router import router as documents_router, template_router as document_templates_router
from app.modules.documentation.router import router as documentation_router
from app.modules.integrations.router import lms_router, router as integrations_router
from app.modules.imports.router import router as imports_router
from app.modules.interactions.router import router as interactions_router
from app.modules.licenses.router import router as licenses_router
from app.modules.materials.router import router as materials_router
from app.modules.notifications.router import router as notifications_router
from app.modules.nba.router import router as nba_router
from app.modules.organizations.router import router as organizations_router
from app.modules.products.router import router as products_router
from app.modules.program_instances.router import router as program_instances_router
from app.modules.programs.router import router as programs_router
from app.modules.tasks.router import router as tasks_router
from app.modules.teachers.router import router as teachers_router
from app.modules.system_status.router import router as system_status_router
from app.modules.universities.router import router as universities_router
from app.modules.users.router import router as users_router
from app.modules.workflows.router import router as workflows_router
from app.modules.workflow_catalog.router import router as workflow_catalog_router
from app.modules.checklists.router import router as checklists_router
from app.modules.reports.program_router import router as reports_router

api_router = APIRouter()


@api_router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "backend"}


@api_router.get("/ready")
def readiness_check() -> dict[str, str]:
    """Return success only when the process can reach its critical database."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="service is not ready") from exc
    return {"status": "ok", "service": "backend"}


api_router.include_router(analytics_router)
api_router.include_router(audit_router)
api_router.include_router(auth_router)
api_router.include_router(cohorts_router)
api_router.include_router(contacts_router)
api_router.include_router(documents_router)
api_router.include_router(document_templates_router)
api_router.include_router(documentation_router)
api_router.include_router(integrations_router)
api_router.include_router(lms_router)
api_router.include_router(imports_router)
api_router.include_router(interactions_router)
api_router.include_router(licenses_router)
api_router.include_router(materials_router)
api_router.include_router(notifications_router)
api_router.include_router(nba_router)
api_router.include_router(organizations_router)
api_router.include_router(products_router)
api_router.include_router(program_instances_router)
api_router.include_router(programs_router)
api_router.include_router(tasks_router)
api_router.include_router(system_status_router)
api_router.include_router(teachers_router)
api_router.include_router(universities_router)
api_router.include_router(users_router)
api_router.include_router(workflows_router)
api_router.include_router(workflow_catalog_router)
api_router.include_router(checklists_router)
api_router.include_router(reports_router)

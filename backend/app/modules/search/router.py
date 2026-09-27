from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.modules.auth.access import CRM_ROLES, get_subordinate_kam_ids, has_any_role, is_admin
from app.modules.auth.dependencies import require_roles
from app.modules.organizations.model import OrgAssignment, Organization, Stakeholder
from app.modules.products.model import ITProduct, Vendor
from app.modules.program_instances.model import ProgramInstance
from app.modules.programs.model import ITDirection
from app.modules.users.model import User

router = APIRouter(prefix="/search", tags=["search"])


def _visible_organizations(current_user: User, db: Session):
    statement = select(Organization.id)
    if is_admin(current_user):
        return statement
    kam_ids = get_subordinate_kam_ids(db, current_user.id) if has_any_role(current_user, "MANAGER") else {current_user.id}
    return statement.join(OrgAssignment).where(OrgAssignment.user_id.in_(kam_ids), OrgAssignment.status == "active")


@router.get("", dependencies=[Depends(require_roles(*CRM_ROLES))])
def global_search(
    q: str = Query(min_length=2, max_length=100),
    limit: int = Query(default=8, ge=1, le=20),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CRM_ROLES)),
) -> dict[str, list[dict[str, str]]]:
    """Search operational entities only; sensitive B2C identity fields are never queried."""
    pattern = f"%{q.strip()}%"
    organization_ids = _visible_organizations(current_user, db)
    organizations = db.execute(
        select(Organization.id, Organization.name)
        .where(Organization.id.in_(organization_ids), Organization.name.ilike(pattern))
        .order_by(Organization.name)
        .limit(limit)
    ).all()
    programs = db.execute(
        select(ProgramInstance.id, Organization.name, ITDirection.name, ITProduct.name)
        .join(Organization, Organization.id == ProgramInstance.organization_id)
        .join(ITDirection, ITDirection.id == ProgramInstance.direction_id)
        .join(ITProduct, ITProduct.id == ProgramInstance.product_id)
        .where(ProgramInstance.organization_id.in_(organization_ids), (ITDirection.name.ilike(pattern) | ITProduct.name.ilike(pattern)))
        .order_by(Organization.name)
        .limit(limit)
    ).all()
    stakeholders = db.execute(
        select(Stakeholder.id, Stakeholder.full_name, Organization.id, Organization.name)
        .join(Organization, Organization.id == Stakeholder.organization_id)
        .where(Stakeholder.organization_id.in_(organization_ids), Stakeholder.full_name.ilike(pattern), Stakeholder.is_active.is_(True))
        .order_by(Stakeholder.full_name)
        .limit(limit)
    ).all()
    products = db.execute(
        select(ITProduct.id, ITProduct.name, Vendor.name)
        .outerjoin(Vendor, Vendor.id == ITProduct.vendor_id)
        .where(ITProduct.name.ilike(pattern), ITProduct.is_active.is_(True))
        .order_by(ITProduct.name)
        .limit(limit)
    ).all()
    vendors = db.execute(
        select(Vendor.id, Vendor.name).where(Vendor.name.ilike(pattern), Vendor.is_active.is_(True)).order_by(Vendor.name).limit(limit)
    ).all()
    return {
        "organizations": [{"id": str(item.id), "label": item.name, "path": f"/organizations/{item.id}"} for item in organizations],
        "programs": [{"id": str(item.id), "label": f"{item[1]} · {item[2]} · {item[3]}", "path": f"/programs/{item.id}"} for item in programs],
        "stakeholders": [{"id": str(item[0]), "label": f"{item[1]} · {item[3]}", "path": f"/organizations/{item[2]}"} for item in stakeholders],
        "products": [{"id": str(item.id), "label": f"{item.name}{f' · {item[2]}' if item[2] else ''}", "path": "/organizations"} for item in products],
        "vendors": [{"id": str(item.id), "label": item.name, "path": "/organizations"} for item in vendors],
    }

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.auth.access import get_subordinate_kam_ids, has_any_role, is_admin
from app.modules.organizations.model import OrgAssignment, Organization, OrganizationType, Stakeholder
from app.modules.organizations.schemas import AssignmentCreate, OrganizationCreate, OrganizationUpdate, StakeholderCreate
from app.modules.users.model import User


class OrganizationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, current_user: User, search: str | None, limit: int, offset: int) -> ListResult[Organization]:
        statement = select(Organization)
        if not is_admin(current_user):
            kam_ids = get_subordinate_kam_ids(self.db, current_user.id) if has_any_role(current_user, "MANAGER") else {current_user.id}
            statement = statement.where(exists().where(OrgAssignment.organization_id == Organization.id, OrgAssignment.user_id.in_(kam_ids), OrgAssignment.status == "active"))
        if search:
            statement = statement.where(Organization.name.ilike(f"%{search}%"))
        total = self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0
        return ListResult(list(self.db.scalars(statement.order_by(Organization.name).limit(limit).offset(offset)).all()), total)

    def get(self, organization_id: UUID, current_user: User) -> Organization:
        organization = self.db.get(Organization, organization_id)
        if organization is None:
            raise HTTPException(status_code=404, detail="Organization not found")
        if not is_admin(current_user):
            kam_ids = get_subordinate_kam_ids(self.db, current_user.id) if has_any_role(current_user, "MANAGER") else {current_user.id}
            visible = self.db.scalar(select(exists().where(OrgAssignment.organization_id == organization_id, OrgAssignment.user_id.in_(kam_ids), OrgAssignment.status == "active")))
            if not visible:
                raise HTTPException(status_code=403, detail="Cannot access this organization")
        return organization

    def create(self, payload: OrganizationCreate, current_user: User) -> Organization:
        if self.db.get(OrganizationType, payload.type_id) is None:
            raise HTTPException(status_code=422, detail="Organization type not found")
        kam_id = payload.kam_user_id or current_user.id
        kam_user = self.db.get(User, kam_id)
        if kam_user is None or not has_any_role(kam_user, "KAM"):
            raise HTTPException(status_code=422, detail="Organization must be assigned to a KAM user")
        if has_any_role(current_user, "KAM") and kam_id != current_user.id:
            raise HTTPException(status_code=403, detail="KAM can only create assigned organizations")
        if has_any_role(current_user, "MANAGER") and kam_id not in get_subordinate_kam_ids(self.db, current_user.id):
            raise HTTPException(status_code=403, detail="KAM is outside manager scope")
        organization = Organization(**payload.model_dump(exclude={"kam_user_id"}))
        self.db.add(organization)
        self.db.flush()
        self._assign(organization.id, kam_id, current_user.id)
        self.db.commit()
        self.db.refresh(organization)
        return organization

    def update(self, organization_id: UUID, payload: OrganizationUpdate, current_user: User) -> Organization:
        organization = self.get(organization_id, current_user)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(organization, field, value)
        self.db.commit()
        self.db.refresh(organization)
        return organization

    def assign(self, organization_id: UUID, payload: AssignmentCreate, current_user: User) -> OrgAssignment:
        if not (is_admin(current_user) or has_any_role(current_user, "MANAGER")):
            raise HTTPException(status_code=403, detail="Only MANAGER or ADMIN can assign KAM")
        self.get(organization_id, current_user)
        kam_user = self.db.get(User, payload.kam_user_id)
        if kam_user is None or not has_any_role(kam_user, "KAM"):
            raise HTTPException(status_code=422, detail="Organization must be assigned to a KAM user")
        if has_any_role(current_user, "MANAGER") and payload.kam_user_id not in get_subordinate_kam_ids(self.db, current_user.id):
            raise HTTPException(status_code=403, detail="KAM is outside manager scope")
        now = datetime.now(timezone.utc)
        for assignment in self.db.scalars(select(OrgAssignment).where(OrgAssignment.organization_id == organization_id, OrgAssignment.status == "active")):
            assignment.status, assignment.ended_at = "ended", now
        assignment = self._assign(organization_id, payload.kam_user_id, current_user.id, now)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def stakeholders(self, organization_id: UUID, current_user: User) -> list[Stakeholder]:
        self.get(organization_id, current_user)
        return list(self.db.scalars(select(Stakeholder).where(Stakeholder.organization_id == organization_id).order_by(Stakeholder.full_name)).all())

    def add_stakeholder(self, organization_id: UUID, payload: StakeholderCreate, current_user: User) -> Stakeholder:
        self.get(organization_id, current_user)
        stakeholder = Stakeholder(organization_id=organization_id, **payload.model_dump())
        self.db.add(stakeholder)
        self.db.commit()
        self.db.refresh(stakeholder)
        return stakeholder

    def _assign(self, organization_id: UUID, kam_user_id: UUID, assigned_by: UUID, assigned_at: datetime | None = None) -> OrgAssignment:
        assignment = OrgAssignment(organization_id=organization_id, user_id=kam_user_id, assigned_by=assigned_by, assigned_at=assigned_at or datetime.now(timezone.utc), status="active")
        self.db.add(assignment)
        return assignment

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.contacts.model import UniversityContact
from app.modules.contacts.repository import UniversityContactRepository
from app.modules.contacts.schemas import UniversityContactCreate, UniversityContactUpdate


class UniversityContactService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = UniversityContactRepository(db)

    def list_contacts(
        self,
        *,
        search: str | None,
        university_id: UUID | None,
        is_active: bool | None,
        is_primary: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[UniversityContact]:
        return self.repository.list(
            filters={"university_id": university_id, "is_active": is_active, "is_primary": is_primary},
            search=search,
            search_fields=("full_name", "position", "email", "phone", "department"),
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def list_contacts_for_manager(
        self,
        *,
        manager_user_id: UUID | set[UUID],
        search: str | None,
        university_id: UUID | None,
        is_active: bool | None,
        is_primary: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[UniversityContact]:
        return self.repository.list_for_manager(
            manager_user_id=manager_user_id,
            filters={"university_id": university_id, "is_active": is_active, "is_primary": is_primary},
            search=search,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_contact(self, contact_id: UUID) -> UniversityContact:
        contact = self.repository.get(contact_id)
        if contact is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University contact not found")
        return contact

    def create_contact(self, payload: UniversityContactCreate) -> UniversityContact:
        contact = UniversityContact(**payload.model_dump())
        self.repository.add(contact)
        self.db.commit()
        self.db.refresh(contact)
        return contact

    def update_contact(self, contact_id: UUID, payload: UniversityContactUpdate) -> UniversityContact:
        contact = self.get_contact(contact_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(contact, field, value)
        self.db.commit()
        self.db.refresh(contact)
        return contact

    def deactivate_contact(self, contact_id: UUID) -> UniversityContact:
        contact = self.get_contact(contact_id)
        contact.is_active = False
        self.db.commit()
        self.db.refresh(contact)
        return contact

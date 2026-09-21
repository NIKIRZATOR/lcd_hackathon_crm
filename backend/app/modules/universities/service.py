from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.universities.model import University
from app.modules.universities.repository import UniversityRepository
from app.modules.universities.schemas import UniversityCreate, UniversityUpdate


class UniversityService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = UniversityRepository(db)

    def list_universities(
        self,
        *,
        search: str | None,
        is_active: bool | None,
        region: str | None,
        city: str | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[University]:
        return self.repository.list(
            filters={"is_active": is_active, "region": region, "city": city},
            search=search,
            search_fields=("name", "short_name", "region", "city"),
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def list_universities_for_manager(
        self,
        *,
        manager_user_id: UUID | set[UUID],
        search: str | None,
        is_active: bool | None,
        region: str | None,
        city: str | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[University]:
        return self.repository.list_for_manager(
            manager_user_id=manager_user_id,
            filters={"is_active": is_active, "region": region, "city": city},
            search=search,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_university(self, university_id: UUID) -> University:
        university = self.repository.get(university_id)
        if university is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University not found")
        return university

    def create_university(self, payload: UniversityCreate) -> University:
        university = University(**payload.model_dump())
        self.repository.add(university)
        self.db.commit()
        self.db.refresh(university)
        return university

    def update_university(self, university_id: UUID, payload: UniversityUpdate) -> University:
        university = self.get_university(university_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(university, field, value)
        self.db.commit()
        self.db.refresh(university)
        return university

    def deactivate_university(self, university_id: UUID) -> University:
        university = self.get_university(university_id)
        university.is_active = False
        self.db.commit()
        self.db.refresh(university)
        return university

from sqlalchemy.orm import Session

from app.modules.universities.model import University
from app.modules.universities.repository import UniversityRepository
from app.modules.universities.schemas import UniversityCreate


class UniversityService:
    def __init__(self, db: Session) -> None:
        self.repository = UniversityRepository(db)

    def list_universities(self) -> list[University]:
        return self.repository.list()

    def create_university(self, payload: UniversityCreate) -> University:
        university = University(**payload.model_dump())
        return self.repository.add(university)

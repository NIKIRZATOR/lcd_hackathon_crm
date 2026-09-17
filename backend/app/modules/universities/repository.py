from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.universities.model import University


class UniversityRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, university_id: UUID) -> University | None:
        return self.db.get(University, university_id)

    def list(self) -> list[University]:
        return list(self.db.query(University).order_by(University.name).all())

    def add(self, university: University) -> University:
        self.db.add(university)
        self.db.flush()
        return university

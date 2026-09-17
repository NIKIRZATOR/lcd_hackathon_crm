from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.modules.universities.schemas import UniversityCreate, UniversityRead
from app.modules.universities.service import UniversityService

router = APIRouter(prefix="/universities", tags=["universities"])


@router.get("", response_model=list[UniversityRead])
def list_universities(db: Session = Depends(get_db_session)):
    return UniversityService(db).list_universities()


@router.post("", response_model=UniversityRead, status_code=201)
def create_university(payload: UniversityCreate, db: Session = Depends(get_db_session)):
    return UniversityService(db).create_university(payload)

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.common.repository import ListResult
from app.modules.programs.model import ITDirection, ITProgram
from app.modules.programs.repository import ITDirectionRepository, ITProgramRepository
from app.modules.programs.schemas import (
    ITDirectionCreate,
    ITDirectionUpdate,
    ITProgramCreate,
    ITProgramUpdate,
)


class ITDirectionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = ITDirectionRepository(db)

    def list_directions(
        self,
        *,
        search: str | None,
        is_active: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[ITDirection]:
        return self.repository.list(
            filters={"is_active": is_active},
            search=search,
            search_fields=("name", "code", "description"),
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_direction(self, direction_id: UUID) -> ITDirection:
        direction = self.repository.get(direction_id)
        if direction is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="IT direction not found")
        return direction

    def create_direction(self, payload: ITDirectionCreate) -> ITDirection:
        direction = ITDirection(**payload.model_dump())
        self.repository.add(direction)
        self.db.commit()
        self.db.refresh(direction)
        return direction

    def update_direction(self, direction_id: UUID, payload: ITDirectionUpdate) -> ITDirection:
        direction = self.get_direction(direction_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(direction, field, value)
        self.db.commit()
        self.db.refresh(direction)
        return direction

    def deactivate_direction(self, direction_id: UUID) -> ITDirection:
        direction = self.get_direction(direction_id)
        direction.is_active = False
        self.db.commit()
        self.db.refresh(direction)
        return direction


class ITProgramService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = ITProgramRepository(db)

    def list_programs(
        self,
        *,
        search: str | None,
        direction_id: UUID | None,
        is_active: bool | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: str,
    ) -> ListResult[ITProgram]:
        return self.repository.list(
            filters={"direction_id": direction_id, "is_active": is_active},
            search=search,
            search_fields=("name", "description", "version"),
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_program(self, program_id: UUID) -> ITProgram:
        program = self.repository.get(program_id)
        if program is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="IT program not found")
        return program

    def create_program(self, payload: ITProgramCreate) -> ITProgram:
        program = ITProgram(**payload.model_dump())
        self.repository.add(program)
        self.db.commit()
        self.db.refresh(program)
        return program

    def update_program(self, program_id: UUID, payload: ITProgramUpdate) -> ITProgram:
        program = self.get_program(program_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(program, field, value)
        self.db.commit()
        self.db.refresh(program)
        return program

    def deactivate_program(self, program_id: UUID) -> ITProgram:
        program = self.get_program(program_id)
        program.is_active = False
        self.db.commit()
        self.db.refresh(program)
        return program

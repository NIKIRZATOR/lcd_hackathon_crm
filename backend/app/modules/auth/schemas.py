from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CurrentUserRead(BaseModel):
    id: UUID
    keycloak_user_id: UUID
    username: str
    email: str | None = None
    full_name: str
    roles: list[str]

    model_config = ConfigDict(from_attributes=True)

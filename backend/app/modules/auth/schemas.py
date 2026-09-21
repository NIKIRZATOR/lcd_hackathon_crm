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


class TokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int | None = None
    refresh_expires_in: int | None = None
    refresh_token: str | None = None
    scope: str | None = None

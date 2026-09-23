from functools import lru_cache
from typing import Any

import httpx
import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient

from app.core.config import settings


class KeycloakTokenVerifier:
    def __init__(self) -> None:
        self._jwks_client: PyJWKClient | None = None

    def verify(self, token: str) -> dict[str, Any]:
        try:
            signing_key = self._get_jwks_client().get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=settings.keycloak_audience,
                issuer=[settings.keycloak_issuer, settings.keycloak_internal_issuer],
                options={"require": ["exp", "iat", "iss", "sub"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    def _get_jwks_client(self) -> PyJWKClient:
        if self._jwks_client is None:
            metadata = self._load_openid_configuration()
            jwks_uri = metadata.get("jwks_uri")
            if not jwks_uri:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Keycloak JWKS URI is unavailable",
                )
            internal_jwks_uri = jwks_uri.replace(settings.keycloak_url.rstrip("/"), settings.keycloak_base_url)
            self._jwks_client = PyJWKClient(internal_jwks_uri)
        return self._jwks_client

    @staticmethod
    def _load_openid_configuration() -> dict[str, Any]:
        try:
            response = httpx.get(settings.keycloak_openid_configuration_url, timeout=5)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Keycloak OpenID configuration is unavailable",
            ) from exc


@lru_cache
def get_token_verifier() -> KeycloakTokenVerifier:
    return KeycloakTokenVerifier()

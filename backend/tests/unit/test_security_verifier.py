import pytest
from fastapi import HTTPException
from jwt import ExpiredSignatureError, InvalidAudienceError, InvalidIssuerError, InvalidSignatureError

from app.core.security import KeycloakTokenVerifier


class FakeSigningKey:
    key = "public-key"


class FakeJwksClient:
    def get_signing_key_from_jwt(self, token: str):
        return FakeSigningKey()


def make_verifier(monkeypatch, decode):
    verifier = KeycloakTokenVerifier()
    monkeypatch.setattr(verifier, "_get_jwks_client", lambda: FakeJwksClient())
    monkeypatch.setattr("app.core.security.jwt.decode", decode)
    return verifier


def test_verifier_accepts_external_or_internal_issuer_allowlist(monkeypatch) -> None:
    seen = {}

    def decode(token, key, algorithms, audience, issuer, options):
        seen["audience"] = audience
        seen["issuer"] = issuer
        return {"sub": "11111111-1111-1111-1111-111111111111"}

    verifier = make_verifier(monkeypatch, decode)

    assert verifier.verify("token")["sub"]
    assert seen["audience"] == "rtk-eduflow-backend"
    assert "http://localhost:8080/realms/rtk-eduflow" in seen["issuer"]
    assert len(seen["issuer"]) == 2


@pytest.mark.parametrize(
    "error",
    [
        InvalidIssuerError("unknown issuer"),
        InvalidAudienceError("wrong audience"),
        InvalidSignatureError("bad signature"),
    ],
)
def test_verifier_rejects_invalid_jwt_claims(monkeypatch, error) -> None:
    def decode(token, key, algorithms, audience, issuer, options):
        raise error

    verifier = make_verifier(monkeypatch, decode)

    with pytest.raises(HTTPException) as exc:
        verifier.verify("token")

    assert exc.value.status_code == 401


def test_verifier_rejects_expired_token(monkeypatch) -> None:
    def decode(token, key, algorithms, audience, issuer, options):
        raise ExpiredSignatureError("expired")

    verifier = make_verifier(monkeypatch, decode)

    with pytest.raises(HTTPException) as exc:
        verifier.verify("token")

    assert exc.value.status_code == 401

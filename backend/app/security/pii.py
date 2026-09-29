import base64
import hashlib
import hmac
import os
import json
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _key() -> bytes:
    if not settings.pii_encryption_key:
        raise RuntimeError("PII_ENCRYPTION_KEY is required when PII encryption is enabled")
    try:
        key = base64.urlsafe_b64decode(settings.pii_encryption_key)
    except ValueError as exc:
        raise RuntimeError("PII_ENCRYPTION_KEY must be URL-safe base64") from exc
    if len(key) != 32:
        raise RuntimeError("PII_ENCRYPTION_KEY must decode to 32 bytes")
    return key


def encrypt_pii(value: str | None) -> str | None:
    if value is None or not settings.pii_encryption_enabled:
        return value
    nonce = os.urandom(12)
    return "enc:v1:" + base64.urlsafe_b64encode(nonce + AESGCM(_key()).encrypt(nonce, value.encode(), None)).decode()


def decrypt_pii(value: str | None) -> str | None:
    if value is None or not value.startswith("enc:v1:"):
        return value
    payload = base64.urlsafe_b64decode(value.removeprefix("enc:v1:"))
    return AESGCM(_key()).decrypt(payload[:12], payload[12:], None).decode()


def hmac_pii(value: str | None) -> str | None:
    if not value:
        return None
    if not settings.pii_hmac_pepper:
        raise RuntimeError("PII_HMAC_PEPPER is required for PII matching")
    return hmac.new(settings.pii_hmac_pepper.encode(), value.encode(), hashlib.sha256).hexdigest()


def encrypt_pii_payload(payload: dict[str, Any]) -> dict[str, str] | dict[str, Any]:
    encrypted = encrypt_pii(json.dumps(payload, ensure_ascii=False, default=str))
    return {"encrypted_payload": encrypted} if encrypted != json.dumps(payload, ensure_ascii=False, default=str) else payload

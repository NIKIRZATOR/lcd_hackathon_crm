import base64
import io

import pytest

from app.core.config import settings
from app.security.antivirus import ClamAvScanner, ScanResult
from app.security.pii import decrypt_pii, encrypt_pii, hmac_pii


def test_encrypt_decrypt_and_wrong_key(monkeypatch) -> None:
    key = base64.urlsafe_b64encode(b"a" * 32).decode()
    monkeypatch.setattr(settings, "pii_encryption_enabled", True)
    monkeypatch.setattr(settings, "pii_encryption_key", key)
    encrypted = encrypt_pii("secret")
    assert encrypted != "secret"
    assert decrypt_pii(encrypted) == "secret"
    monkeypatch.setattr(settings, "pii_encryption_key", base64.urlsafe_b64encode(b"b" * 32).decode())
    with pytest.raises(Exception):
        decrypt_pii(encrypted)


def test_hmac_matching_and_disabled_antivirus(monkeypatch) -> None:
    monkeypatch.setattr(settings, "pii_hmac_pepper", "pepper")
    assert hmac_pii("mail@example.test") == hmac_pii("mail@example.test")
    monkeypatch.setattr(settings, "antivirus_enabled", False)
    assert ClamAvScanner().scan(io.BytesIO(b"content")) is ScanResult.NOT_SCANNED

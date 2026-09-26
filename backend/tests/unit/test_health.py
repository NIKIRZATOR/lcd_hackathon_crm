from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from app.main import create_app


def test_health_endpoint_returns_ok() -> None:
    client = TestClient(create_app())

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "backend"}


def test_readiness_endpoint_returns_ok() -> None:
    mock_connection = MagicMock()
    mock_connection.__enter__.return_value = mock_connection
    with patch("app.api.router.engine.connect", return_value=mock_connection):
        client = TestClient(create_app())

        response = client.get("/api/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "backend"}

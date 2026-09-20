from fastapi.testclient import TestClient

from app.main import create_app


def test_not_found_uses_error_envelope() -> None:
    client = TestClient(create_app())

    response = client.get("/api/missing", headers={"X-Request-ID": "stage0-test"})

    assert response.status_code == 404
    assert response.headers["X-Request-ID"] == "stage0-test"
    assert response.json() == {
        "code": "NOT_FOUND",
        "message": "Not Found",
        "details": None,
        "requestId": "stage0-test",
    }


def test_validation_error_uses_error_envelope() -> None:
    client = TestClient(create_app())

    response = client.get("/api/universities", params={"limit": 0})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert body["message"] == "Request validation failed"
    assert body["requestId"]
    assert isinstance(body["details"], list)

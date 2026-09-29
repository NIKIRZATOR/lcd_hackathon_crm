from types import SimpleNamespace
from uuid import uuid4

import app.modules.nba.router as nba_router


class FakeResult:
    def all(self):
        return []

    def one(self):
        return (0, 0, 0, 0)


class FakeDatabase:
    def scalar(self, *_args, **_kwargs):
        return 0

    def execute(self, *_args, **_kwargs):
        return FakeResult()

    def get(self, *_args, **_kwargs):
        return None


def user_with_role(role: str):
    return SimpleNamespace(id=uuid4(), roles=[SimpleNamespace(name=role)])


def test_admin_receives_technical_home_data(monkeypatch) -> None:
    technical_summary = {"role": "ADMIN", "cards": {}, "system_status": [{"component": "Backend"}]}

    monkeypatch.setattr(nba_router, "AdminHomeService", lambda _db: SimpleNamespace(summary=lambda: technical_summary))

    assert nba_router.home_summary(FakeDatabase(), user_with_role("ADMIN")) == technical_summary


def test_kam_and_manager_do_not_receive_admin_technical_data(monkeypatch) -> None:
    monkeypatch.setattr(nba_router, "AdminHomeService", lambda _db: (_ for _ in ()).throw(AssertionError("ADMIN service must not be used")))
    monkeypatch.setattr(nba_router, "get_subordinate_kam_ids", lambda *_args: set())
    monkeypatch.setattr(nba_router, "NbaService", lambda _db: SimpleNamespace(today=lambda _user: []))

    for role in ("KAM", "MANAGER"):
        payload = nba_router.home_summary(FakeDatabase(), user_with_role(role))
        assert payload["role"] == role
        assert "system_status" not in payload
        assert "attention_items" not in payload
        if role == "KAM":
            assert payload["items"] == []

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.imports.apply.service import ImportApplyService


class FakeDialect:
    name = "postgresql"


class FakeBind:
    dialect = FakeDialect()


class FakeDb:
    def __init__(self) -> None:
        self.executed = []

    def get_bind(self):
        return FakeBind()

    def execute(self, statement, params=None):
        self.executed.append((str(statement), params))


class FreshDiff:
    def __init__(self, db) -> None:
        self.db = db

    def input_hash(self, job):
        return "input"

    def mapping_hash(self, job):
        return "mapping"

    def crm_fingerprint(self, items):
        return "crm"


class StaleDiff(FreshDiff):
    def crm_fingerprint(self, items):
        return "changed"


def make_job():
    return SimpleNamespace(
        id=uuid4(),
        diff_snapshot={
            "input_hash": "input",
            "mapping_hash": "mapping",
            "crm_fingerprint": "crm",
        },
    )


def test_stale_diff_guard_accepts_matching_fingerprint(monkeypatch) -> None:
    monkeypatch.setattr("app.modules.imports.apply.service.ImportDiffService", FreshDiff)

    ImportApplyService(FakeDb())._ensure_diff_is_fresh(make_job(), [{"businessKey": "a"}])


def test_stale_diff_guard_rejects_changed_crm_state(monkeypatch) -> None:
    monkeypatch.setattr("app.modules.imports.apply.service.ImportDiffService", StaleDiff)

    with pytest.raises(HTTPException) as exc:
        ImportApplyService(FakeDb())._ensure_diff_is_fresh(make_job(), [{"businessKey": "a"}])

    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "IMPORT_STALE_DIFF"


def test_confirm_locks_unique_business_keys_with_advisory_xact_lock() -> None:
    db = FakeDb()

    ImportApplyService(db)._lock_items(
        [
            {"businessKey": "university|product|contract-1"},
            {"businessKey": "university|product|contract-1"},
            {"businessKey": "university|product|contract-2"},
        ]
    )

    assert len(db.executed) == 2
    assert all("pg_advisory_xact_lock" in statement for statement, _ in db.executed)

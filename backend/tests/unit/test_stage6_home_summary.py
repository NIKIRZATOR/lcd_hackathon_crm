from types import SimpleNamespace
from uuid import uuid4

from app.modules.nba.router import home_summary


class _Result:
    def __init__(self, value):
        self.value = value

    def all(self):
        return self.value

    def one(self):
        return self.value


class _Db:
    def __init__(self):
        self.scalar_calls = 0
        self.execute_results = [
            _Result([("green", 2), ("yellow", 1)]),
            _Result((8, 3, 24, 2)),
            _Result([("Осень 2026", __import__("datetime").date(2026, 10, 1))]),
        ]

    def scalar(self, _statement):
        self.scalar_calls += 1
        return 3

    def execute(self, _statement):
        return self.execute_results.pop(0)


def test_kam_home_summary_uses_real_portfolio_and_b2c_aggregates(monkeypatch) -> None:
    user = SimpleNamespace(id=uuid4(), roles=[SimpleNamespace(name="KAM")])
    monkeypatch.setattr(
        "app.modules.nba.router.NbaService.today",
        lambda _self, _user: [{"severity": "high"}, {"severity": "low"}],
    )

    result = home_summary(db=_Db(), current_user=user)

    assert result["role"] == "KAM"
    assert result["cards"] == {"nba_today": 2, "health_attention": 1}
    assert result["portfolio"] == {
        "active_programs": 3,
        "health": {"green": 2, "yellow": 1, "red": 0},
    }
    assert result["b2c"] == {
        "applications": 8,
        "payment_records": 3,
        "students": 24,
        "streams": 2,
    }
    assert result["academic_windows"] == [
        {"title": "Осень 2026", "plan_cutoff_on": "2026-10-01"}
    ]

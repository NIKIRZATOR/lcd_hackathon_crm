from app.modules.nba.service import RULES


def test_nba_rule_catalog_has_all_required_codes() -> None:
    assert set(RULES) == {
        "stage_overdue",
        "semester_window",
        "license_expiring",
        "lms_silence",
        "no_teacher",
        "demand_without_program",
        "next_stage",
    }


def test_nba_rule_codes_are_unique() -> None:
    assert len(RULES) == len(set(RULES))

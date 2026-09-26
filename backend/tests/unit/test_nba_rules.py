from app.modules.nba.service import RULES


def test_nba_rule_catalog_has_all_required_codes() -> None:
    assert {
        "stage_overdue",
        "semester_window",
        "license_expiring",
        "lms_silence",
        "no_teacher",
        "demand_without_program",
        "next_stage",
        "stage_overdue_8_plus",
        "license_expired",
        "teacher_left",
        "organization_without_program",
        "integration_unmatched",
    } <= set(RULES)


def test_nba_rule_codes_are_unique() -> None:
    assert len(RULES) == len(set(RULES))

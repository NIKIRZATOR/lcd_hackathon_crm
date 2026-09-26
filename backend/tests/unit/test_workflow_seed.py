from scripts.workflow_seed_data import WORKFLOW_STAGES, WORKFLOW_TEMPLATE


def test_official_workflow_seed_has_canonical_shape() -> None:
    assert WORKFLOW_TEMPLATE["name"] == "RTK EduFlow Full Cycle"
    assert len(WORKFLOW_STAGES) == 13
    assert [stage["order_index"] for stage in WORKFLOW_STAGES] == list(range(1, 14))
    assert sum(1 for stage in WORKFLOW_STAGES if stage.get("is_initial")) == 1
    assert sum(1 for stage in WORKFLOW_STAGES if stage.get("is_final")) == 1
    assert WORKFLOW_STAGES[0]["name"] == "Поиск контакта"
    assert WORKFLOW_STAGES[-1]["name"] == "Итоги периода"
    assert all(stage["name"] != "Контроль" for stage in WORKFLOW_STAGES)

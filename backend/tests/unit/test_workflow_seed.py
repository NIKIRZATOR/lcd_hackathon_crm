from scripts.workflow_seed_data import WORKFLOW_STAGES, WORKFLOW_TEMPLATE


def test_official_workflow_seed_has_expected_shape() -> None:
    stage_names = [stage["name"] for stage in WORKFLOW_STAGES]
    order_indexes = [stage["order_index"] for stage in WORKFLOW_STAGES]

    assert WORKFLOW_TEMPLATE["name"] == "RTK EduFlow Base Workflow"
    assert len(WORKFLOW_STAGES) == 14
    assert len(stage_names) == len(set(stage_names))
    assert order_indexes == list(range(1, 15))
    assert sum(1 for stage in WORKFLOW_STAGES if stage.get("is_initial")) == 1
    assert sum(1 for stage in WORKFLOW_STAGES if stage.get("is_final")) == 1
    assert WORKFLOW_STAGES[0]["is_initial"] is True
    assert WORKFLOW_STAGES[-1]["is_final"] is True


def test_official_workflow_seed_marks_document_correction_optional() -> None:
    optional_stages = [stage for stage in WORKFLOW_STAGES if stage.get("is_optional")]

    assert [stage["order_index"] for stage in optional_stages] == [5]
    assert optional_stages[0]["name"] == "Корректировка документов перед подписанием"


def test_official_workflow_seed_requires_attachment_for_document_signing() -> None:
    document_signing_stage = next(stage for stage in WORKFLOW_STAGES if stage["order_index"] == 6)

    assert document_signing_stage["name"] == "Подписание документов"
    assert document_signing_stage["requires_attachment"] is True

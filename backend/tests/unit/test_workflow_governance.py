from uuid import uuid4

from app.modules.workflows.model import WorkflowStage, WorkflowTransition
from app.modules.workflows.service import WorkflowVersionService


def make_stage(
    *,
    name: str,
    version_id,
    order_index: int,
    is_initial: bool = False,
    is_final: bool = False,
    requires_comment: bool = False,
) -> WorkflowStage:
    return WorkflowStage(
        id=uuid4(),
        workflow_template_id=uuid4(),
        workflow_version_id=version_id,
        name=name,
        order_index=order_index,
        is_initial=is_initial,
        is_final=is_final,
        requires_comment=requires_comment,
        is_active=True,
    )


def make_transition(*, version_id, from_stage: WorkflowStage, to_stage: WorkflowStage) -> WorkflowTransition:
    return WorkflowTransition(
        id=uuid4(),
        workflow_template_id=from_stage.workflow_template_id,
        workflow_version_id=version_id,
        from_stage_id=from_stage.id,
        to_stage_id=to_stage.id,
    )


def test_dangerous_changes_detect_removed_stage_transition_and_contract_change() -> None:
    service = WorkflowVersionService.__new__(WorkflowVersionService)
    source_version_id = uuid4()
    draft_version_id = uuid4()
    source_start = make_stage(name="Start", version_id=source_version_id, order_index=1, is_initial=True)
    source_review = make_stage(name="Review", version_id=source_version_id, order_index=2, requires_comment=False)
    source_finish = make_stage(name="Finish", version_id=source_version_id, order_index=3, is_final=True)
    draft_start = make_stage(name="Start", version_id=draft_version_id, order_index=1, is_initial=True)
    draft_review = make_stage(name="Review", version_id=draft_version_id, order_index=2, requires_comment=True)

    changes = service._build_dangerous_changes(
        draft_stages=[draft_start, draft_review],
        source_stages=[source_start, source_review, source_finish],
        draft_transitions=[make_transition(version_id=draft_version_id, from_stage=draft_start, to_stage=draft_review)],
        source_transitions=[
            make_transition(version_id=source_version_id, from_stage=source_start, to_stage=source_review),
            make_transition(version_id=source_version_id, from_stage=source_review, to_stage=source_finish),
        ],
        active_interaction_count=3,
    )

    change_types = {change.change_type for change in changes}
    assert "STAGE_REMOVED" in change_types
    assert "STAGE_CONTRACT_CHANGED" in change_types
    assert "TRANSITION_REMOVED" in change_types
    assert any(change.severity == "HIGH" for change in changes)


def test_dangerous_changes_treat_added_stage_and_transition_as_low_severity() -> None:
    service = WorkflowVersionService.__new__(WorkflowVersionService)
    source_version_id = uuid4()
    draft_version_id = uuid4()
    source_start = make_stage(name="Start", version_id=source_version_id, order_index=1, is_initial=True)
    source_finish = make_stage(name="Finish", version_id=source_version_id, order_index=2, is_final=True)
    draft_start = make_stage(name="Start", version_id=draft_version_id, order_index=1, is_initial=True)
    draft_review = make_stage(name="Review", version_id=draft_version_id, order_index=2)
    draft_finish = make_stage(name="Finish", version_id=draft_version_id, order_index=3, is_final=True)

    changes = service._build_dangerous_changes(
        draft_stages=[draft_start, draft_review, draft_finish],
        source_stages=[source_start, source_finish],
        draft_transitions=[
            make_transition(version_id=draft_version_id, from_stage=draft_start, to_stage=draft_finish),
        ],
        source_transitions=[make_transition(version_id=source_version_id, from_stage=source_start, to_stage=source_finish)],
        active_interaction_count=0,
    )

    assert {change.severity for change in changes} == {"LOW"}
    assert {change.change_type for change in changes} == {"STAGE_ADDED", "STAGE_ORDER_CHANGED"}


def test_migration_preview_reports_missing_mapping_for_active_stage() -> None:
    service = WorkflowVersionService.__new__(WorkflowVersionService)
    source_version_id = uuid4()
    target_version_id = uuid4()
    source_stage = make_stage(name="Removed", version_id=source_version_id, order_index=1)
    target_stage = make_stage(name="Different", version_id=target_version_id, order_index=1)

    class StageRepository:
        def list_active_by_version(self, version_id):
            if version_id == source_version_id:
                return [source_stage]
            return [target_stage]

    class MappingRepository:
        def list_by_versions(self, source_id, target_id):
            return []

    service.stage_repository = StageRepository()
    service.stage_mapping_repository = MappingRepository()

    mappings = service._resolve_stage_mappings(source_version_id, target_version_id, [], persist=False)

    assert source_stage.id not in mappings

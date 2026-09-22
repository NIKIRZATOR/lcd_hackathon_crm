from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.workflows.model import WorkflowStage, WorkflowTransition, WorkflowVersion
from app.modules.workflows.service import WorkflowRuntimeService, WorkflowVersionService


def make_stage(
    *,
    version_id,
    order_index: int,
    is_initial: bool = False,
    is_final: bool = False,
    is_optional: bool = False,
) -> WorkflowStage:
    return WorkflowStage(
        id=uuid4(),
        workflow_template_id=uuid4(),
        workflow_version_id=version_id,
        name=f"Stage {order_index}",
        order_index=order_index,
        is_initial=is_initial,
        is_final=is_final,
        is_optional=is_optional,
        is_active=True,
    )


def make_transition(
    *,
    version_id,
    from_stage: WorkflowStage,
    to_stage: WorkflowStage,
    is_default: bool = False,
) -> WorkflowTransition:
    return WorkflowTransition(
        id=uuid4(),
        workflow_template_id=from_stage.workflow_template_id,
        workflow_version_id=version_id,
        from_stage_id=from_stage.id,
        to_stage_id=to_stage.id,
        is_default=is_default,
    )


def test_publish_graph_accepts_forward_backward_optional_and_branch() -> None:
    version = WorkflowVersion(id=uuid4(), workflow_template_id=uuid4(), version=2, status="DRAFT")
    initial = make_stage(version_id=version.id, order_index=1, is_initial=True)
    optional = make_stage(version_id=version.id, order_index=2, is_optional=True)
    regular = make_stage(version_id=version.id, order_index=3)
    final = make_stage(version_id=version.id, order_index=4, is_final=True)

    transitions = [
        make_transition(version_id=version.id, from_stage=initial, to_stage=optional, is_default=True),
        make_transition(version_id=version.id, from_stage=initial, to_stage=regular),
        make_transition(version_id=version.id, from_stage=optional, to_stage=regular, is_default=True),
        make_transition(version_id=version.id, from_stage=regular, to_stage=initial),
        make_transition(version_id=version.id, from_stage=regular, to_stage=final, is_default=True),
    ]

    service = WorkflowVersionService.__new__(WorkflowVersionService)

    service._validate_publish_graph(version, [initial, optional, regular, final], transitions)


def test_publish_graph_requires_single_initial_stage() -> None:
    version = WorkflowVersion(id=uuid4(), workflow_template_id=uuid4(), version=2, status="DRAFT")
    stage_1 = make_stage(version_id=version.id, order_index=1, is_initial=True)
    stage_2 = make_stage(version_id=version.id, order_index=2, is_initial=True, is_final=True)
    transition = make_transition(version_id=version.id, from_stage=stage_1, to_stage=stage_2)
    service = WorkflowVersionService.__new__(WorkflowVersionService)

    with pytest.raises(HTTPException) as error:
        service._validate_publish_graph(version, [stage_1, stage_2], [transition])

    assert error.value.status_code == 400


def test_publish_graph_rejects_transition_to_another_version_stage() -> None:
    version = WorkflowVersion(id=uuid4(), workflow_template_id=uuid4(), version=2, status="DRAFT")
    other_version_id = uuid4()
    stage_1 = make_stage(version_id=version.id, order_index=1, is_initial=True)
    stage_2 = make_stage(version_id=version.id, order_index=2, is_final=True)
    foreign_stage = make_stage(version_id=other_version_id, order_index=3)
    transition = make_transition(version_id=version.id, from_stage=stage_1, to_stage=foreign_stage)
    service = WorkflowVersionService.__new__(WorkflowVersionService)

    with pytest.raises(HTTPException) as error:
        service._validate_publish_graph(version, [stage_1, stage_2], [transition])

    assert error.value.status_code == 400


def test_available_transition_kind_classification() -> None:
    version_id = uuid4()
    current = make_stage(version_id=version_id, order_index=5)
    next_stage = make_stage(version_id=version_id, order_index=6)
    previous_stage = make_stage(version_id=version_id, order_index=4)
    optional_stage = make_stage(version_id=version_id, order_index=7, is_optional=True)
    service = WorkflowRuntimeService.__new__(WorkflowRuntimeService)

    assert service._classify_transition(current, next_stage, is_branch=False) == "FORWARD"
    assert service._classify_transition(current, previous_stage, is_branch=False) == "BACKWARD"
    assert service._classify_transition(current, optional_stage, is_branch=False) == "OPTIONAL"
    assert service._classify_transition(current, next_stage, is_branch=True) == "BRANCH"

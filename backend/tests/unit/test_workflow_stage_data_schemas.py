import pytest
from pydantic import ValidationError

from app.modules.workflows.stage_data_schemas import (
    STAGE_DATA_MODELS,
    stage_data_json_schemas,
    validate_stage_payload,
)


def test_all_runtime_stages_expose_json_schema() -> None:
    assert set(stage_data_json_schemas()) == set(STAGE_DATA_MODELS)
    assert len(STAGE_DATA_MODELS) == 13


def test_stage_payload_is_normalized() -> None:
    payload = validate_stage_payload(
        "sign_contract",
        {"status": "received", "signer": "Demo", "version": 1},
    )

    assert payload == {"status": "received", "signer": "Demo", "version": 1}


def test_stage_payload_rejects_fields_from_another_stage() -> None:
    with pytest.raises(ValidationError):
        validate_stage_payload("sign_contract", {"replacement_requested": True})


def test_stage_payload_rejects_unknown_enum_value() -> None:
    with pytest.raises(ValidationError):
        validate_stage_payload("transfer_access", {"status": "done"})

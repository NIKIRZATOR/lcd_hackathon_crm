from typing import Literal

from pydantic import BaseModel, ConfigDict


class StagePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_type: str | None = None
    version: int | None = None


class FindContactData(StagePayload):
    source: Literal["university_card", "call", "email", "site", "event", "referral", "other"] | None = None
    note: str | None = None


class FirstMeetingData(StagePayload):
    time: str | None = None
    outcome: Literal["go_product", "follow_up", "rejected"] | None = None
    note: str | None = None


class IdentifyNeedData(StagePayload):
    reason: str | None = None
    format: Literal["module", "course", "program", "other"] | None = None
    limits: str | None = None


class DocumentPackageData(StagePayload):
    contract_project_ready: bool | None = None
    materials_ready: bool | None = None
    comment: str | None = None


class SignContractData(StagePayload):
    status: Literal["draft", "sent", "received", "rejected"] | None = None
    signer: str | None = None
    comment: str | None = None


class SignLicenseData(StagePayload):
    status: Literal["draft", "sent", "received", "rejected"] | None = None
    volume: str | None = None
    comment: str | None = None


class TransferAccessData(StagePayload):
    status: Literal["not_transferred", "in_progress", "transferred", "revoked"] | None = None
    recipient: str | None = None
    access: str | None = None


class TrainTeacherData(StagePayload):
    status: Literal["not_started", "scheduled", "in_progress", "trained", "failed"] | None = None
    format: Literal["vendor", "internal", "self_study", "other"] | None = None
    comment: str | None = None


class ConfirmTeacherData(StagePayload):
    ready: Literal["yes", "no", "pending"] | None = None
    reason: str | None = None


class CurriculumData(StagePayload):
    comment: str | None = None
    plan_ready: bool | None = None


class StartClassesData(StagePayload):
    confirmed: bool | None = None
    comment: str | None = None


class ClassesRunningData(StagePayload):
    status: Literal["ok", "attention", "blocked", "completed"] | None = None
    comment: str | None = None
    replacement_requested: bool | None = None


class PeriodResultsData(StagePayload):
    verdict: Literal["continue", "pause", "complete", "stop"] | None = None
    reason: str | None = None
    comment: str | None = None


STAGE_DATA_MODELS: dict[str, type[StagePayload]] = {
    "find_contact": FindContactData,
    "first_meeting": FirstMeetingData,
    "identify_need": IdentifyNeedData,
    "document_package": DocumentPackageData,
    "sign_contract": SignContractData,
    "sign_license": SignLicenseData,
    "transfer_access": TransferAccessData,
    "train_teacher": TrainTeacherData,
    "confirm_teacher": ConfirmTeacherData,
    "curriculum": CurriculumData,
    "start_classes": StartClassesData,
    "classes_running": ClassesRunningData,
    "period_results": PeriodResultsData,
}


def validate_stage_payload(stage_code: str, payload: dict) -> dict:
    model = STAGE_DATA_MODELS.get(stage_code)
    if model is None:
        return StagePayload.model_validate(payload).model_dump(mode="json", exclude_none=True)
    return model.model_validate(payload).model_dump(mode="json", exclude_none=True)


def stage_data_json_schemas() -> dict[str, dict]:
    return {code: model.model_json_schema() for code, model in STAGE_DATA_MODELS.items()}

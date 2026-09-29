from __future__ import annotations

import os
import secrets
from uuid import uuid4

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

TOKEN = os.environ.get("LMS_SERVICE_TOKEN", "")
CRM_CALLBACK_URL = os.environ.get("CRM_CALLBACK_URL", "http://backend:8000").rstrip("/")
app = FastAPI(title="RTK EduFlow Mock LMS", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])
programs: dict[str, dict] = {}


def require_token(value: str | None) -> None:
    if not TOKEN or not value or not secrets.compare_digest(value, TOKEN):
        raise HTTPException(status_code=401, detail="Invalid LMS service token")


class ProgramPayload(BaseModel):
    program_instance_id: str
    organization: str | None = None
    program: dict[str, str | None]
    stream: str | None = None
    dates: dict[str, str | None]


class DemoEvent(BaseModel):
    external_program_id: str
    type: str = Field(pattern="^(STUDENT_ENROLLED|COURSE_STARTED|COURSE_COMPLETED)$")
    student_count: int = Field(default=0, ge=0)
    event_id: str | None = None


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "mock-lms"}


@app.post("/api/programs")
def create_program(payload: ProgramPayload, x_lms_service_token: str | None = Header(default=None)) -> dict[str, str]:
    require_token(x_lms_service_token)
    external_id = f"LMS-{payload.program_instance_id[:8]}"
    programs[external_id] = payload.model_dump()
    return {"external_id": external_id, "status": "created"}


@app.post("/api/demo/events")
async def demo_event(payload: DemoEvent, x_lms_service_token: str | None = Header(default=None)) -> dict:
    require_token(x_lms_service_token)
    event = {"event_id": payload.event_id or f"evt-{uuid4()}", "external_program_id": payload.external_program_id, "type": payload.type, "data": {"student_count": payload.student_count}}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{CRM_CALLBACK_URL}/api/integrations/lms/events", json=event, headers={"X-LMS-Service-Token": TOKEN})
    return {"event": event, "crm_status": response.status_code, "crm_response": response.json()}

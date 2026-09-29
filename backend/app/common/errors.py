from http import HTTPStatus
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException


REQUEST_ID_HEADER = "X-Request-ID"


class ErrorEnvelope(BaseModel):
    code: str
    message: str
    details: Any | None
    request_id: str


STATUS_CODE_MAP = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    500: "INTERNAL_ERROR",
    503: "SERVICE_UNAVAILABLE",
}


def default_message_for_status(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).phrase
    except ValueError:
        return "Error"


def error_payload(
    *,
    status_code: int,
    message: str | None,
    request_id: str,
    code: str | None = None,
    details: Any | None = None,
) -> dict[str, Any]:
    envelope = ErrorEnvelope(
        code=code or STATUS_CODE_MAP.get(status_code, "ERROR"),
        message=message or default_message_for_status(status_code),
        details=details,
        request_id=request_id,
    )
    return envelope.model_dump()


def get_request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    return request_id or request.headers.get(REQUEST_ID_HEADER) or str(uuid4())


def install_error_handlers(application: FastAPI) -> None:
    @application.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request.state.request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid4())
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request.state.request_id
        return response

    @application.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail
        code = None
        message = str(detail) if detail else None
        details = None

        if isinstance(detail, dict):
            if {"code", "message", "details"}.intersection(detail):
                code = detail.get("code")
                message = detail.get("message")
                details = detail.get("details")
            else:
                message = None
                details = detail
        elif not isinstance(detail, str):
            message = None
            details = detail

        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(
                status_code=exc.status_code,
                code=code,
                message=message,
                details=details,
                request_id=get_request_id(request),
            ),
            headers=getattr(exc, "headers", None),
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=error_payload(
                status_code=422,
                message="Request validation failed",
                details=exc.errors(),
                request_id=get_request_id(request),
            ),
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=error_payload(
                status_code=500,
                message="Internal server error",
                request_id=get_request_id(request),
            ),
        )

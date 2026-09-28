from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.api.router import health_check, readiness_check
from app.common.errors import install_error_handlers
from app.core.config import settings
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    configure_logging()

    application = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
    )
    application.mount(
        "/images",
        StaticFiles(directory=Path(__file__).resolve().parents[1] / "images"),
        name="images",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @application.middleware("http")
    async def add_optional_diagnostic_header(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/images/"):
            response.headers["Cache-Control"] = "no-cache, max-age=0"
        if settings.enable_diagnostic_headers:
            import os

            response.headers["X-Backend-Instance"] = os.getenv("HOSTNAME", "unknown")
        return response

    install_error_handlers(application)

    @application.get("/")
    def root() -> dict[str, str]:
        return {"service": "backend", "message": f"{settings.app_name} backend is running"}

    @application.get("/health")
    def root_health_check() -> dict[str, str]:
        return health_check()

    @application.get("/ready")
    def root_readiness_check() -> dict[str, str]:
        return readiness_check()

    application.include_router(api_router, prefix=settings.api_prefix)
    return application


app = create_app()

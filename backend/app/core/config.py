from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "edu_crm"
    app_env: str = "development"
    debug: bool = False
    api_prefix: str = "/api"
    database_url: str = Field(
        default="postgresql+psycopg://rtk_eduflow:rtk_eduflow@localhost:5432/rtk_eduflow"
    )
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout: int = 30
    enable_diagnostic_headers: bool = False
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    keycloak_url: str = "http://localhost:8080"
    keycloak_internal_url: str | None = None
    keycloak_realm: str = "rtk-eduflow"
    keycloak_frontend_client_id: str = "rtk-eduflow-frontend"
    keycloak_backend_client_id: str = "rtk-eduflow-backend"
    keycloak_audience: str = "rtk-eduflow-backend"
    s3_endpoint: str = "localhost:9000"
    s3_access_key: str = "rtk_eduflow_minio"
    s3_secret_key: str = "rtk_eduflow_minio_secret"
    s3_region: str = "us-east-1"
    s3_use_ssl: bool = False
    s3_bucket_workflow_files: str = "workflow-files"
    s3_bucket_imports: str = "imports"
    s3_bucket_reports: str = "reports"
    s3_bucket_documentation: str = "documentation"
    s3_bucket_organization_logos: str = "organization-logos"
    s3_bucket_user_avatars: str = "user-avatars"
    file_retention_days: int = 30
    file_max_upload_bytes: int = 25 * 1024 * 1024
    import_max_upload_bytes: int = 25 * 1024 * 1024
    import_max_rows: int = 10_000
    import_max_columns: int = 100
    import_max_sheets: int = 20
    import_preview_rows: int = 20
    import_file_retention_days: int = 90
    redis_url: str = "redis://localhost:6379/0"
    report_queue_name: str = "reports"
    report_worker_concurrency: int = 1
    report_file_retention_days: int = 90
    backup_status_path: Path = Path("/backups/last-successful.json")
    backup_heartbeat_path: Path = Path("/backups/scheduler-heartbeat.json")
    backup_heartbeat_ttl_seconds: int = 180
    antivirus_enabled: bool = False
    antivirus_host: str = "clamav"
    antivirus_port: int = 3310
    pii_encryption_enabled: bool = False
    pii_encryption_key: str | None = None
    pii_hmac_pepper: str | None = None
    lms_mock_enabled: bool = False
    lms_base_url: str = "http://mock-lms:8080"
    lms_service_token: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str) and value.lower() in {"release", "production", "prod"}:
            return False
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def keycloak_base_url(self) -> str:
        return (self.keycloak_internal_url or self.keycloak_url).rstrip("/")

    @property
    def keycloak_issuer(self) -> str:
        return f"{self.keycloak_url.rstrip('/')}/realms/{self.keycloak_realm}"

    @property
    def keycloak_internal_issuer(self) -> str:
        return f"{self.keycloak_base_url}/realms/{self.keycloak_realm}"

    @property
    def keycloak_openid_configuration_url(self) -> str:
        return f"{self.keycloak_base_url}/realms/{self.keycloak_realm}/.well-known/openid-configuration"

    @property
    def keycloak_token_url(self) -> str:
        return f"{self.keycloak_base_url}/realms/{self.keycloak_realm}/protocol/openid-connect/token"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

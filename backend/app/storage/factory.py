from app.core.config import settings
from app.storage.adapter import StorageAdapter
from app.storage.s3 import S3CompatibleStorage


def get_storage_adapter() -> StorageAdapter:
    return S3CompatibleStorage(
        endpoint=settings.s3_endpoint,
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
        region=settings.s3_region,
        secure=settings.s3_use_ssl,
    )

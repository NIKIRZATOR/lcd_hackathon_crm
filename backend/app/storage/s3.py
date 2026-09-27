from datetime import timedelta
from typing import BinaryIO

from app.storage.adapter import ObjectStat


class S3CompatibleStorage:
    def __init__(
        self,
        *,
        endpoint: str,
        access_key: str,
        secret_key: str,
        region: str,
        secure: bool,
    ) -> None:
        try:
            from minio import Minio
        except ImportError as exc:
            raise RuntimeError("Install the `minio` package to use S3CompatibleStorage.") from exc

        self._client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            region=region,
            secure=secure,
        )

    def put(
        self,
        *,
        bucket: str,
        object_key: str,
        data: BinaryIO,
        length: int,
        content_type: str | None = None,
    ) -> ObjectStat:
        result = self._client.put_object(
            bucket,
            object_key,
            data,
            length,
            content_type=content_type or "application/octet-stream",
        )
        stat = self.stat(bucket=bucket, object_key=object_key)
        return ObjectStat(
            bucket=bucket,
            object_key=object_key,
            size=stat.size,
            etag=result.etag or stat.etag,
            content_type=stat.content_type,
            last_modified=stat.last_modified,
        )

    def healthcheck(self) -> None:
        self._client.list_buckets()

    def get_stream(self, *, bucket: str, object_key: str) -> BinaryIO:
        return self._client.get_object(bucket, object_key)

    def delete(self, *, bucket: str, object_key: str) -> None:
        self._client.remove_object(bucket, object_key)

    def stat(self, *, bucket: str, object_key: str) -> ObjectStat:
        result = self._client.stat_object(bucket, object_key)
        return ObjectStat(
            bucket=bucket,
            object_key=object_key,
            size=result.size,
            etag=result.etag,
            content_type=result.content_type,
            last_modified=result.last_modified,
        )

    def presign_get(self, *, bucket: str, object_key: str, expires_seconds: int) -> str:
        return self._client.presigned_get_object(
            bucket,
            object_key,
            expires=timedelta(seconds=expires_seconds),
        )

from dataclasses import dataclass
from datetime import datetime
from typing import BinaryIO, Protocol


@dataclass(frozen=True)
class ObjectStat:
    bucket: str
    object_key: str
    size: int
    etag: str | None = None
    content_type: str | None = None
    last_modified: datetime | None = None


class StorageAdapter(Protocol):
    def healthcheck(self) -> None:
        """Raise an exception when object storage is unavailable."""

    def put(
        self,
        *,
        bucket: str,
        object_key: str,
        data: BinaryIO,
        length: int,
        content_type: str | None = None,
    ) -> ObjectStat:
        """Store an object and return storage metadata."""

    def get_stream(self, *, bucket: str, object_key: str) -> BinaryIO:
        """Return a readable stream for an object."""

    def delete(self, *, bucket: str, object_key: str) -> None:
        """Delete an object if it exists."""

    def stat(self, *, bucket: str, object_key: str) -> ObjectStat:
        """Return object metadata."""

    def presign_get(self, *, bucket: str, object_key: str, expires_seconds: int) -> str:
        """Return a temporary object download URL."""

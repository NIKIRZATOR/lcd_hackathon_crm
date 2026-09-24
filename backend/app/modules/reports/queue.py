from uuid import UUID

from app.core.config import settings


def get_report_queue_name() -> str:
    return settings.report_queue_name


def get_redis_client():
    try:
        from redis import Redis
    except ImportError as exc:
        raise RuntimeError("Install the `redis` package to use report background jobs.") from exc

    return Redis.from_url(settings.redis_url, decode_responses=True)


def enqueue_report_job(job_id: UUID, *, redis_client=None, queue_name: str | None = None) -> None:
    client = redis_client or get_redis_client()
    client.lpush(queue_name or get_report_queue_name(), str(job_id))


def dequeue_report_job(*, redis_client=None, queue_name: str | None = None, timeout_seconds: int = 5) -> UUID | None:
    client = redis_client or get_redis_client()
    result = client.brpop(queue_name or get_report_queue_name(), timeout=timeout_seconds)
    if result is None:
        return None
    _, raw_job_id = result
    return UUID(raw_job_id)

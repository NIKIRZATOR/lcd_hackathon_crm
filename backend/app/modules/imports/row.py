from datetime import datetime, timezone

from app.modules.imports.mapping.registry import normalize_text


def snapshot_fields(snapshot: dict | None) -> list[dict]:
    if not snapshot:
        return []
    return list(snapshot.get("fields") or [])


def mapped_row(raw_row: dict[str, object | None], snapshot: dict | None) -> dict[str, object | None]:
    result: dict[str, object | None] = {}
    for field in snapshot_fields(snapshot):
        result[field["target_field"]] = raw_row.get(field["source_column"])
    return result


def source_column_for(snapshot: dict | None, target_field: str) -> str | None:
    for field in snapshot_fields(snapshot):
        if field["target_field"] == target_field:
            return field["source_column"]
    return None


def parse_datetime(value: object | None) -> datetime | None:
    text = normalize_text(value)
    if text is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if text.isdigit() and len(text) == 4:
        return datetime(int(text), 12, 31, tzinfo=timezone.utc)
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def business_key(row: dict[str, object | None]) -> str:
    parts = [
        normalize_text(row.get("university.name")) or "",
        normalize_text(row.get("vendor.name")) or "",
        normalize_text(row.get("product.name")) or "",
        normalize_text(row.get("contract.number")) or "",
    ]
    return "|".join(part.casefold() for part in parts)


def serializable_payload(row: dict[str, object | None]) -> dict[str, object | None]:
    payload = dict(row)
    for key in ("license.signed_at", "license.valid_until"):
        parsed = parse_datetime(payload.get(key))
        payload[key] = parsed.isoformat() if parsed else normalize_text(payload.get(key))
    return payload

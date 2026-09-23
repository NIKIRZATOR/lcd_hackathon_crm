from dataclasses import dataclass
from datetime import date, datetime, time
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import BinaryIO, Protocol

from fastapi import HTTPException


class SpreadsheetError(HTTPException):
    def __init__(self, *, code: str, message: str, status_code: int = 400, details: dict | None = None) -> None:
        super().__init__(status_code=status_code, detail={"code": code, "message": message, "details": details})


@dataclass(frozen=True)
class SpreadsheetMetadata:
    sheet_names: list[str]
    file_type: str


@dataclass(frozen=True)
class SpreadsheetPreview:
    sheet_names: list[str]
    sheet: str
    headers: list[str]
    rows: list[list[object | None]]
    total_rows: int
    file_type: str


class SpreadsheetReader(Protocol):
    file_type: str

    def read_metadata(self) -> SpreadsheetMetadata:
        ...

    def preview(self, *, sheet_name: str | None = None, header_row: int = 1, limit: int = 20) -> SpreadsheetPreview:
        ...

    def iter_rows(self, *, sheet_name: str | None = None, header_row: int = 1) -> list[tuple[int, dict[str, object | None]]]:
        ...


def normalize_cell(value: object | None) -> object | None:
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned or None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, time):
        return value.isoformat()
    return value


def headers_from_values(values: list[object | None]) -> list[str]:
    return [str(normalize_cell(value) or "").strip() for value in values]


def ensure_not_empty(headers: list[str], data_rows: list[list[object | None]] | None = None) -> None:
    if not any(headers):
        raise SpreadsheetError(code="IMPORT_EMPTY_SHEET", message="Spreadsheet header row is empty")
    if data_rows is not None and not any(any(cell is not None for cell in row) for row in data_rows):
        raise SpreadsheetError(code="IMPORT_EMPTY_SHEET", message="Spreadsheet contains no data rows")


def stream_to_temp_file(stream: BinaryIO, suffix: str) -> Path:
    with NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        while chunk := stream.read(1024 * 1024):
            temp.write(chunk)
        return Path(temp.name)

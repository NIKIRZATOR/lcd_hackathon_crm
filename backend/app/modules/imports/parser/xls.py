from pathlib import Path

import xlrd

from app.core.config import settings
from app.modules.imports.parser.base import (
    SpreadsheetError,
    SpreadsheetMetadata,
    SpreadsheetPreview,
    ensure_not_empty,
    headers_from_values,
    normalize_cell,
)


XLS_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


class XlsSpreadsheetReader:
    file_type = "xls"

    def __init__(self, path: Path) -> None:
        self.path = path
        if self.path.read_bytes()[:8] != XLS_SIGNATURE:
            raise SpreadsheetError(code="IMPORT_INVALID_FORMAT", message="File is not a valid legacy XLS document")

    def _book(self):
        try:
            return xlrd.open_workbook(self.path)
        except Exception as exc:
            raise SpreadsheetError(code="IMPORT_INVALID_FORMAT", message="Cannot read XLS file") from exc

    def _cell_value(self, book, cell):
        if cell.ctype == xlrd.XL_CELL_EMPTY:
            return None
        if cell.ctype == xlrd.XL_CELL_DATE:
            try:
                return xlrd.xldate.xldate_as_datetime(cell.value, book.datemode)
            except Exception:
                return cell.value
        if cell.ctype == xlrd.XL_CELL_BOOLEAN:
            return bool(cell.value)
        return normalize_cell(cell.value)

    def read_metadata(self) -> SpreadsheetMetadata:
        book = self._book()
        if len(book.sheet_names()) > settings.import_max_sheets:
            raise SpreadsheetError(code="IMPORT_TOO_MANY_SHEETS", message="Spreadsheet has too many sheets")
        return SpreadsheetMetadata(sheet_names=book.sheet_names(), file_type=self.file_type)

    def preview(self, *, sheet_name: str | None = None, header_row: int = 1, limit: int = 20) -> SpreadsheetPreview:
        book = self._book()
        sheet = book.sheet_by_name(sheet_name) if sheet_name else book.sheet_by_index(0)
        header_index = header_row - 1
        headers = headers_from_values([self._cell_value(book, cell) for cell in sheet.row(header_index)])
        self._validate_dimensions(headers=headers, total_rows=max(sheet.nrows - header_row, 0))
        rows: list[list[object | None]] = []
        for row_index in range(header_row, sheet.nrows):
            normalized = [self._cell_value(book, cell) for cell in sheet.row(row_index)[: len(headers)]]
            if any(cell is not None for cell in normalized):
                rows.append(normalized)
            if len(rows) >= limit:
                break
        ensure_not_empty(headers, rows)
        return SpreadsheetPreview(
            sheet_names=book.sheet_names(),
            sheet=sheet.name,
            headers=headers,
            rows=rows,
            total_rows=max(sheet.nrows - header_row, 0),
            file_type=self.file_type,
        )

    def iter_rows(self, *, sheet_name: str | None = None, header_row: int = 1) -> list[tuple[int, dict[str, object | None]]]:
        book = self._book()
        sheet = book.sheet_by_name(sheet_name) if sheet_name else book.sheet_by_index(0)
        headers = headers_from_values([self._cell_value(book, cell) for cell in sheet.row(header_row - 1)])
        self._validate_dimensions(headers=headers, total_rows=max(sheet.nrows - header_row, 0))
        ensure_not_empty(headers)
        result: list[tuple[int, dict[str, object | None]]] = []
        for row_index in range(header_row, sheet.nrows):
            normalized = [self._cell_value(book, cell) for cell in sheet.row(row_index)[: len(headers)]]
            if any(cell is not None for cell in normalized):
                result.append((row_index + 1, dict(zip(headers, normalized, strict=False))))
        return result

    def _validate_dimensions(self, *, headers: list[str], total_rows: int) -> None:
        if len(headers) > settings.import_max_columns:
            raise SpreadsheetError(code="IMPORT_TOO_MANY_COLUMNS", message="Spreadsheet has too many columns")
        if total_rows > settings.import_max_rows:
            raise SpreadsheetError(code="IMPORT_TOO_MANY_ROWS", message="Spreadsheet has too many rows")

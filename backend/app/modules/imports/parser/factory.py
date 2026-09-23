from pathlib import Path

from app.modules.imports.parser.base import SpreadsheetError, SpreadsheetReader
from app.modules.imports.parser.xls import XlsSpreadsheetReader
from app.modules.imports.parser.xlsx import XlsxSpreadsheetReader


def reader_for_path(path: Path, original_name: str) -> SpreadsheetReader:
    extension = Path(original_name).suffix.lower()
    if extension == ".xlsx":
        return XlsxSpreadsheetReader(path)
    if extension == ".xls":
        return XlsSpreadsheetReader(path)
    raise SpreadsheetError(
        code="IMPORT_UNSUPPORTED_FILE",
        message="Only .xls and .xlsx spreadsheets are supported",
        details={"extension": extension},
    )

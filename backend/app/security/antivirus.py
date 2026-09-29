import socket
from enum import StrEnum
from typing import BinaryIO

from app.core.config import settings


class ScanResult(StrEnum):
    CLEAN = "CLEAN"
    INFECTED = "INFECTED"
    SCAN_ERROR = "SCAN_ERROR"
    NOT_SCANNED = "NOT_SCANNED"


class ClamAvScanner:
    def scan(self, stream: BinaryIO) -> ScanResult:
        if not settings.antivirus_enabled:
            return ScanResult.NOT_SCANNED
        try:
            with socket.create_connection((settings.antivirus_host, settings.antivirus_port), timeout=10) as connection:
                connection.sendall(b"zINSTREAM\0")
                stream.seek(0)
                while chunk := stream.read(1024 * 1024):
                    connection.sendall(len(chunk).to_bytes(4, "big") + chunk)
                connection.sendall((0).to_bytes(4, "big"))
                reply = connection.recv(4096).decode("utf-8", "replace")
        except OSError:
            return ScanResult.SCAN_ERROR
        finally:
            stream.seek(0)
        return ScanResult.INFECTED if "FOUND" in reply else ScanResult.CLEAN if "OK" in reply else ScanResult.SCAN_ERROR

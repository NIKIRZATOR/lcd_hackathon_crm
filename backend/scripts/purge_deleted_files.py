from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import app.models  # noqa: F401
from app.core.database import SessionLocal
from app.modules.documents.file_service import FileService


def main() -> None:
    parser = argparse.ArgumentParser(description="Purge expired soft-deleted files from object storage.")
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        purged_count = FileService(db).purge_expired_files(limit=args.limit)
    finally:
        db.close()

    print(f"Purged files: {purged_count}")


if __name__ == "__main__":
    main()

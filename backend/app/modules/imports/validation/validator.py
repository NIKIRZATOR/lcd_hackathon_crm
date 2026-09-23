from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.imports.mapping.registry import REQUIRED_TARGETS, TARGET_FIELD_BY_KEY, normalize_text, normalized_key
from app.modules.imports.mapping.service import import_error
from app.modules.imports.model import ImportJob, ImportRowError
from app.modules.imports.row import mapped_row, parse_datetime, snapshot_fields, source_column_for
from app.modules.imports.service import ImportService
from app.modules.products.model import ITProduct, Vendor
from app.modules.universities.model import University
from app.modules.users.model import User


class ImportValidator:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.audit = AuditEventRepository(db)

    def validate(self, *, job_id: UUID, actor_user_id: UUID, request_id: str | None = None) -> ImportJob:
        job = ImportService(self.db).get_job(job_id)
        if not job.mapping_snapshot:
            raise import_error("IMPORT_MAPPING_INVALID", "Import mapping must be set before validation", 409)

        self.db.execute(delete(ImportRowError).where(ImportRowError.import_job_id == job.id))
        errors: list[ImportRowError] = []
        rows = ImportService(self.db).read_rows(job)
        if not rows:
            errors.append(self._error(job, 0, None, None, "IMPORT_EMPTY_SHEET", "Spreadsheet contains no data rows"))
        self._validate_mapping_columns(job, rows, errors)

        lookup = self._build_lookup()
        for row_number, raw_row in rows:
            row = mapped_row(raw_row, job.mapping_snapshot)
            self._validate_required(job, row_number, row, errors)
            self._validate_dates(job, row_number, row, errors)
            self._validate_references(job, row_number, row, lookup, errors)

        for error in errors:
            self.db.add(error)
        job.total_rows = len(rows)
        invalid_rows = {error.row_number for error in errors if error.row_number > 0}
        job.invalid_rows = len(invalid_rows)
        job.valid_rows = max(job.total_rows - job.invalid_rows, 0)
        job.validated_at = datetime.now(timezone.utc)
        job.status = "VALIDATED" if errors else "READY"
        job.diff_snapshot = None
        job.create_count = job.update_count = job.skip_count = job.conflict_count = 0
        self.audit.add(
            AuditEvent(
                actor_user_id=actor_user_id,
                action="import.validate",
                entity_type="import_job",
                entity_id=job.id,
                event_metadata={
                    "total_rows": job.total_rows,
                    "valid_rows": job.valid_rows,
                    "invalid_rows": job.invalid_rows,
                },
                request_id=request_id,
            )
        )
        self.db.commit()
        self.db.refresh(job)
        return job

    def _validate_mapping_columns(
        self,
        job: ImportJob,
        rows: list[tuple[int, dict[str, object | None]]],
        errors: list[ImportRowError],
    ) -> None:
        fields = snapshot_fields(job.mapping_snapshot)
        targets = {field["target_field"] for field in fields}
        unknown = sorted(target for target in targets if target not in TARGET_FIELD_BY_KEY)
        for target in unknown:
            errors.append(self._error(job, 0, None, target, "UNKNOWN_TARGET_FIELD", "Unknown target field"))
        missing_targets = sorted(REQUIRED_TARGETS - targets)
        for target in missing_targets:
            errors.append(self._error(job, 0, None, target, "MISSING_REQUIRED_MAPPING", "Required mapping is missing"))
        headers = set(rows[0][1].keys()) if rows else set()
        for field in fields:
            if field["source_column"] not in headers:
                errors.append(
                    self._error(
                        job,
                        0,
                        field["source_column"],
                        field["target_field"],
                        "MISSING_REQUIRED_COLUMN",
                        "Mapped spreadsheet column is missing",
                    )
                )

    def _validate_required(
        self,
        job: ImportJob,
        row_number: int,
        row: dict[str, object | None],
        errors: list[ImportRowError],
    ) -> None:
        for target in REQUIRED_TARGETS:
            if normalize_text(row.get(target)) is None:
                errors.append(
                    self._error(
                        job,
                        row_number,
                        source_column_for(job.mapping_snapshot, target),
                        target,
                        "MISSING_REQUIRED_FIELD",
                        "Required field is empty",
                    )
                )

    def _validate_dates(
        self,
        job: ImportJob,
        row_number: int,
        row: dict[str, object | None],
        errors: list[ImportRowError],
    ) -> None:
        for target in ("license.signed_at", "license.valid_until"):
            if normalize_text(row.get(target)) is not None and parse_datetime(row.get(target)) is None:
                errors.append(
                    self._error(
                        job,
                        row_number,
                        source_column_for(job.mapping_snapshot, target),
                        target,
                        "INVALID_DATE",
                        "Date value is invalid",
                        raw=row.get(target),
                    )
                )

    def _validate_references(
        self,
        job: ImportJob,
        row_number: int,
        row: dict[str, object | None],
        lookup: dict[str, dict[str, list]],
        errors: list[ImportRowError],
    ) -> None:
        for target, code_prefix, bucket, missing_is_error in (
            ("manager.full_name", "MANAGER", "users_by_name", True),
            ("manager.email", "MANAGER", "users_by_email", True),
            ("university.name", "UNIVERSITY", "universities", False),
            ("vendor.name", "VENDOR", "vendors", False),
            ("product.name", "PRODUCT", "products", False),
        ):
            value = normalized_key(row.get(target))
            if value is None:
                continue
            matches = lookup[bucket].get(value, [])
            if not matches:
                if missing_is_error:
                    errors.append(
                        self._error(
                            job,
                            row_number,
                            source_column_for(job.mapping_snapshot, target),
                            target,
                            f"{code_prefix}_NOT_FOUND",
                            f"{code_prefix.title()} not found",
                            raw=row.get(target),
                        )
                    )
            elif len(matches) > 1:
                errors.append(
                    self._error(
                        job,
                        row_number,
                        source_column_for(job.mapping_snapshot, target),
                        target,
                        f"{code_prefix}_AMBIGUOUS",
                        f"{code_prefix.title()} is ambiguous",
                        raw=row.get(target),
                    )
                )

    def _build_lookup(self) -> dict[str, dict[str, list]]:
        def grouped(values, key_func):
            result: dict[str, list] = {}
            for value in values:
                key = key_func(value)
                if key:
                    result.setdefault(key, []).append(value)
            return result

        users = list(self.db.scalars(select(User).where(User.is_active.is_(True))).all())
        universities = list(self.db.scalars(select(University).where(University.is_active.is_(True))).all())
        vendors = list(self.db.scalars(select(Vendor).where(Vendor.is_active.is_(True))).all())
        products = list(self.db.scalars(select(ITProduct).where(ITProduct.is_active.is_(True))).all())
        return {
            "users_by_name": grouped(users, lambda item: normalized_key(item.full_name)),
            "users_by_email": grouped(users, lambda item: normalized_key(item.email)),
            "universities": grouped(universities, lambda item: normalized_key(item.name)),
            "vendors": grouped(vendors, lambda item: normalized_key(item.name)),
            "products": grouped(products, lambda item: normalized_key(item.name)),
        }

    def _error(
        self,
        job: ImportJob,
        row_number: int,
        column_name: str | None,
        target_field: str | None,
        code: str,
        message: str,
        raw: object | None = None,
    ) -> ImportRowError:
        return ImportRowError(
            import_job_id=job.id,
            row_number=row_number,
            column_name=column_name,
            target_field=target_field,
            error_code=code,
            message=message,
            raw_fragment=normalize_text(raw),
        )

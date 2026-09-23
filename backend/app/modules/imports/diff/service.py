from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.imports.mapping.registry import normalize_text, normalized_key
from app.modules.imports.mapping.service import import_error
from app.modules.imports.model import ImportJob, ImportRowError
from app.modules.imports.row import business_key, mapped_row, serializable_payload
from app.modules.imports.service import ImportService
from app.modules.interactions.model import UniversityInteraction
from app.modules.products.model import ITProduct, Vendor
from app.modules.universities.model import University


class ImportDiffService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.audit = AuditEventRepository(db)

    def build_diff(self, *, job_id: UUID, actor_user_id: UUID, request_id: str | None = None) -> ImportJob:
        job = ImportService(self.db).get_job(job_id)
        if job.status not in {"READY", "VALIDATED"}:
            raise import_error("IMPORT_NOT_READY", "Import must be validated before diff", 409)
        has_errors = self.db.scalar(select(ImportRowError.id).where(ImportRowError.import_job_id == job.id).limit(1))
        if has_errors:
            raise import_error("IMPORT_VALIDATION_FAILED", "Import has validation errors", 409)

        items = []
        counts = {"CREATE": 0, "UPDATE": 0, "SKIP": 0, "CONFLICT": 0}
        for row_number, raw_row in ImportService(self.db).read_rows(job):
            row = mapped_row(raw_row, job.mapping_snapshot)
            item = self._diff_row(row_number, row)
            items.append(item)
            counts[item["action"]] += 1

        job.diff_snapshot = {"items": items}
        job.create_count = counts["CREATE"]
        job.update_count = counts["UPDATE"]
        job.skip_count = counts["SKIP"]
        job.conflict_count = counts["CONFLICT"]
        job.status = "READY"
        self.audit.add(
            AuditEvent(
                actor_user_id=actor_user_id,
                action="import.diff",
                entity_type="import_job",
                entity_id=job.id,
                event_metadata={
                    "create_count": job.create_count,
                    "update_count": job.update_count,
                    "skip_count": job.skip_count,
                    "conflict_count": job.conflict_count,
                },
                request_id=request_id,
            )
        )
        self.db.commit()
        self.db.refresh(job)
        return job

    def _diff_row(self, row_number: int, row: dict[str, object | None]) -> dict:
        key = business_key(row)
        university = self._one_or_none(University, row.get("university.name"))
        vendor = self._one_or_none(Vendor, row.get("vendor.name"))
        product = self._one_or_none(ITProduct, row.get("product.name"))
        if any(value == "AMBIGUOUS" for value in (university, vendor, product)):
            return self._item(row_number, "CONFLICT", key, row, ["Ambiguous reference match"])
        if university is None or vendor is None or product is None:
            return self._item(row_number, "CREATE", key, row, ["Creates missing catalog data or interaction"])

        statement = select(UniversityInteraction).where(
            UniversityInteraction.university_id == university.id,
            UniversityInteraction.product_id == product.id,
            UniversityInteraction.contract_number == normalize_text(row.get("contract.number")),
        )
        matches = list(self.db.scalars(statement).all())
        if len(matches) > 1:
            return self._item(row_number, "CONFLICT", key, row, ["Multiple interactions match business key"])
        if not matches:
            return self._item(row_number, "CREATE", key, row, ["Creates interaction"])
        interaction = matches[0]
        changed = False
        comparisons = {
            "transfer_status": normalize_text(row.get("license.transfer_status")),
            "university_responsibles": normalize_text(row.get("university_contact.full_name")),
            "comment": normalize_text(row.get("interaction.comment")),
        }
        for attr, value in comparisons.items():
            if value is not None and getattr(interaction, attr) != value:
                changed = True
        return self._item(row_number, "UPDATE" if changed else "SKIP", key, row, ["Existing interaction differs"] if changed else [])

    def _one_or_none(self, model, name):
        key = normalized_key(name)
        if key is None:
            return None
        matches = [item for item in self.db.scalars(select(model)).all() if normalized_key(item.name) == key]
        if len(matches) > 1:
            return "AMBIGUOUS"
        return matches[0] if matches else None

    def _item(self, row_number: int, action: str, key: str, row: dict[str, object | None], reasons: list[str]) -> dict:
        return {
            "row": row_number,
            "action": action,
            "entity": "interaction",
            "businessKey": key,
            "business_key": key,
            "reasons": reasons,
            "payload": serializable_payload(row),
        }

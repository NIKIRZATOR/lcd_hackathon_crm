import hashlib
import json
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
from app.modules.licenses.model import Contract, License
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

        job.diff_snapshot = {
            "items": items,
            "input_hash": self.input_hash(job),
            "mapping_hash": self.mapping_hash(job),
            "crm_fingerprint": self.crm_fingerprint(items),
        }
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

        statement = (
            select(UniversityInteraction)
            .join(Contract, Contract.interaction_id == UniversityInteraction.id)
            .where(
                UniversityInteraction.university_id == university.id,
                UniversityInteraction.product_id == product.id,
                Contract.number == normalize_text(row.get("contract.number")),
            )
        )
        matches = list(self.db.scalars(statement).all())
        if len(matches) > 1:
            return self._item(row_number, "CONFLICT", key, row, ["Multiple interactions match business key"])
        if not matches:
            return self._item(row_number, "CREATE", key, row, ["Creates interaction"])
        interaction = matches[0]
        contract = self.db.scalar(
            select(Contract).where(
                Contract.interaction_id == interaction.id,
                Contract.number == normalize_text(row.get("contract.number")),
            )
        )
        license_record = None
        if contract is not None:
            license_record = self.db.scalar(
                select(License).where(License.contract_id == contract.id, License.product_id == product.id)
            )
        changed = False
        comparisons = {
            "university_responsibles": normalize_text(row.get("university_contact.full_name")),
            "comment": normalize_text(row.get("interaction.comment")),
        }
        for attr, value in comparisons.items():
            if value is not None and getattr(interaction, attr) != value:
                changed = True
        if license_record is None:
            changed = True
        elif normalize_text(row.get("license.transfer_status")) is not None and license_record.transfer_status != normalize_text(
            row.get("license.transfer_status")
        ):
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

    def input_hash(self, job) -> str:
        rows = [
            {"row": row_number, "data": mapped_row(raw_row, job.mapping_snapshot)}
            for row_number, raw_row in ImportService(self.db).read_rows(job)
        ]
        return self._hash(rows)

    def mapping_hash(self, job) -> str:
        return self._hash(job.mapping_snapshot or {})

    def crm_fingerprint(self, items: list[dict]) -> str:
        records: list[dict] = []
        for item in items:
            payload = item.get("payload") or {}
            university = self._one_or_none(University, payload.get("university.name"))
            vendor = self._one_or_none(Vendor, payload.get("vendor.name"))
            product = self._one_or_none(ITProduct, payload.get("product.name"))
            record = {
                "business_key": item.get("businessKey") or item.get("business_key"),
                "university": self._entity_state(university),
                "vendor": self._entity_state(vendor),
                "product": self._entity_state(product),
                "interaction": None,
                "contract": None,
                "license": None,
            }
            if not any(value == "AMBIGUOUS" for value in (university, vendor, product)) and university and product:
                contract_number = normalize_text(payload.get("contract.number"))
                interaction = self.db.scalar(
                    select(UniversityInteraction)
                    .join(Contract, Contract.interaction_id == UniversityInteraction.id)
                    .where(
                        UniversityInteraction.university_id == university.id,
                        UniversityInteraction.product_id == product.id,
                        Contract.number == contract_number,
                    )
                )
                record["interaction"] = self._entity_state(interaction)
                if interaction is not None:
                    contract = self.db.scalar(
                        select(Contract).where(Contract.interaction_id == interaction.id, Contract.number == contract_number)
                    )
                    record["contract"] = self._entity_state(contract)
                    if contract is not None:
                        license_record = self.db.scalar(
                            select(License).where(License.contract_id == contract.id, License.product_id == product.id)
                        )
                        record["license"] = self._entity_state(license_record)
            records.append(record)
        return self._hash(records)

    def _entity_state(self, entity) -> dict | None | str:
        if entity is None or entity == "AMBIGUOUS":
            return entity
        return {"id": str(entity.id), "updated_at": entity.updated_at.isoformat() if entity.updated_at else None}

    def _hash(self, value) -> str:
        return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode("utf-8")).hexdigest()

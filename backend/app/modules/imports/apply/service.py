from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.imports.mapping.registry import normalize_text, normalized_key
from app.modules.imports.mapping.service import import_error
from app.modules.imports.diff.service import ImportDiffService
from app.modules.imports.model import ImportJob, ImportRowError
from app.modules.imports.row import parse_datetime
from app.modules.imports.service import ImportService
from app.modules.interactions.model import UniversityInteraction
from app.modules.licenses.model import Contract, License
from app.modules.products.model import ITProduct, ProgramProduct, Vendor
from app.modules.programs.model import ITDirection, ITProgram
from app.modules.universities.model import University
from app.modules.users.model import User


class ImportApplyService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.audit = AuditEventRepository(db)

    def confirm(self, *, job_id: UUID, actor_user_id: UUID, request_id: str | None = None) -> ImportJob:
        job = ImportService(self.db).get_job(job_id)
        if job.status == "DONE" or job.confirmed_at is not None:
            raise import_error("IMPORT_ALREADY_CONFIRMED", "Import job has already been confirmed", 409)
        if not job.diff_snapshot:
            raise import_error("IMPORT_NOT_READY", "Diff must be built before confirm", 409)
        has_errors = self.db.scalar(select(ImportRowError.id).where(ImportRowError.import_job_id == job.id).limit(1))
        if has_errors:
            raise import_error("IMPORT_VALIDATION_FAILED", "Import has validation errors", 409)
        items = list(job.diff_snapshot.get("items") or [])
        conflicts = [item for item in items if item.get("action") == "CONFLICT"]
        if conflicts:
            raise import_error("IMPORT_HAS_CONFLICTS", "Import has unresolved conflicts", 409)

        job.status = "RUNNING"
        job.started_at = datetime.now(timezone.utc)
        try:
            self._lock_items(items)
            self._ensure_diff_is_fresh(job, items)
            for item in items:
                if item.get("action") == "SKIP":
                    continue
                self._apply_item(item["payload"])
            job.status = "DONE"
            job.confirmed_at = datetime.now(timezone.utc)
            job.finished_at = job.confirmed_at
            self.audit.add(
                AuditEvent(
                    actor_user_id=actor_user_id,
                    action="import.confirm",
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
            self.audit.add(
                AuditEvent(
                    actor_user_id=actor_user_id,
                    action="import.complete",
                    entity_type="import_job",
                    entity_id=job.id,
                    event_metadata={"result": "DONE"},
                    result="SUCCESS",
                    request_id=request_id,
                )
            )
            ImportService(self.db).create_json_artifact(
                job=job,
                artifact_type="PROTOCOL",
                actor_user_id=actor_user_id,
                payload=self._protocol_payload(job, "DONE"),
            )
            self.db.commit()
            self.db.refresh(job)
            return job
        except HTTPException:
            self.db.rollback()
            job = ImportService(self.db).get_job(job_id)
            job.status = "READY"
            self.db.commit()
            raise
        except Exception as exc:
            self.db.rollback()
            job = ImportService(self.db).get_job(job_id)
            job.status = "FAILED"
            job.error_code = "IMPORT_APPLY_FAILED"
            job.error_message = "Import apply failed"
            job.finished_at = datetime.now(timezone.utc)
            self.audit.add(
                AuditEvent(
                    actor_user_id=actor_user_id,
                    action="import.fail",
                    entity_type="import_job",
                    entity_id=job.id,
                    event_metadata={"error_code": job.error_code},
                    result="ERROR",
                    request_id=request_id,
                )
            )
            ImportService(self.db).create_json_artifact(
                job=job,
                artifact_type="PROTOCOL",
                actor_user_id=actor_user_id,
                payload=self._protocol_payload(job, "FAILED"),
            )
            self.db.commit()
            raise import_error("IMPORT_APPLY_FAILED", "Import apply failed", 500) from exc

    def _apply_item(self, payload: dict[str, object | None]) -> None:
        university = self._get_or_create(University, normalize_text(payload.get("university.name")))
        vendor = self._get_or_create(Vendor, normalize_text(payload.get("vendor.name")))
        product = self._get_or_create_product(normalize_text(payload.get("product.name")), vendor.id)
        program = self._resolve_program(payload, product.id)
        manager = self._resolve_manager(payload)
        contract_number = normalize_text(payload.get("contract.number"))
        interaction = self._find_interaction(university.id, product.id, contract_number)
        if interaction is None:
            interaction = UniversityInteraction(
                university_id=university.id,
                program_id=program.id,
                product_id=product.id,
                manager_user_id=manager.id if manager else None,
                status="ACTIVE",
                contract_number=contract_number,
            )
            self.db.add(interaction)
        interaction.program_id = program.id
        interaction.manager_user_id = manager.id if manager else interaction.manager_user_id
        interaction.contract_number = contract_number
        interaction.license_signed_at = parse_datetime(payload.get("license.signed_at"))
        interaction.license_signed = interaction.license_signed_at is not None
        interaction.license_valid_until = parse_datetime(payload.get("license.valid_until"))
        interaction.transfer_status = normalize_text(payload.get("license.transfer_status"))
        interaction.university_responsibles = normalize_text(payload.get("university_contact.full_name"))
        interaction.comment = normalize_text(payload.get("interaction.comment"))
        self.db.flush()
        if contract_number:
            contract = self._get_or_create_contract(
                interaction_id=interaction.id,
                number=contract_number,
                signed_at=parse_datetime(payload.get("license.signed_at")),
                valid_until=parse_datetime(payload.get("license.valid_until")),
                status=interaction.status,
            )
            self._get_or_create_license(
                contract_id=contract.id,
                product_id=product.id,
                signed_at=parse_datetime(payload.get("license.signed_at")),
                valid_until=parse_datetime(payload.get("license.valid_until")),
                transfer_status=normalize_text(payload.get("license.transfer_status")),
            )

    def _get_or_create(self, model, name: str | None):
        if not name:
            raise ValueError("required name is missing")
        matches = [item for item in self.db.scalars(select(model)).all() if normalized_key(item.name) == name.casefold()]
        if len(matches) > 1:
            raise ValueError("ambiguous match")
        if matches:
            return matches[0]
        entity = model(name=name)
        self.db.add(entity)
        self.db.flush()
        return entity

    def _get_or_create_product(self, name: str | None, vendor_id: UUID) -> ITProduct:
        if not name:
            raise ValueError("product name is missing")
        matches = [item for item in self.db.scalars(select(ITProduct)).all() if normalized_key(item.name) == name.casefold()]
        if len(matches) > 1:
            raise ValueError("ambiguous product")
        if matches:
            product = matches[0]
            if product.vendor_id is None:
                product.vendor_id = vendor_id
            return product
        product = ITProduct(name=name, vendor_id=vendor_id)
        self.db.add(product)
        self.db.flush()
        return product

    def _resolve_program(self, payload: dict[str, object | None], product_id: UUID) -> ITProgram:
        program_name = normalize_text(payload.get("program.name"))
        if program_name:
            matches = [item for item in self.db.scalars(select(ITProgram)).all() if normalized_key(item.name) == program_name.casefold()]
            if len(matches) == 1:
                return matches[0]
            if len(matches) > 1:
                raise ValueError("ambiguous program")
        direction_name = normalize_text(payload.get("direction.name"))
        if direction_name:
            directions = [
                item for item in self.db.scalars(select(ITDirection)).all() if normalized_key(item.name) == direction_name.casefold()
            ]
            if len(directions) == 1:
                programs = list(self.db.scalars(select(ITProgram).where(ITProgram.direction_id == directions[0].id)).all())
                if len(programs) == 1:
                    return programs[0]
        linked = list(
            self.db.scalars(
                select(ITProgram).join(ProgramProduct, ProgramProduct.program_id == ITProgram.id).where(ProgramProduct.product_id == product_id)
            ).all()
        )
        if len(linked) == 1:
            return linked[0]
        raise ValueError("program cannot be resolved unambiguously")

    def _resolve_manager(self, payload: dict[str, object | None]) -> User | None:
        email = normalize_text(payload.get("manager.email"))
        if email:
            matches = [item for item in self.db.scalars(select(User).where(User.is_active.is_(True))).all() if normalized_key(item.email) == email.casefold()]
            if len(matches) != 1:
                raise ValueError("manager email cannot be resolved")
            return matches[0]
        full_name = normalize_text(payload.get("manager.full_name"))
        if not full_name:
            return None
        matches = [item for item in self.db.scalars(select(User).where(User.is_active.is_(True))).all() if normalized_key(item.full_name) == full_name.casefold()]
        if len(matches) != 1:
            raise ValueError("manager cannot be resolved")
        return matches[0]

    def _find_interaction(self, university_id: UUID, product_id: UUID, contract_number: str | None) -> UniversityInteraction | None:
        if contract_number:
            statement = (
                select(UniversityInteraction)
                .join(Contract, Contract.interaction_id == UniversityInteraction.id)
                .where(
                    UniversityInteraction.university_id == university_id,
                    UniversityInteraction.product_id == product_id,
                    Contract.number == contract_number,
                )
            )
        else:
            statement = select(UniversityInteraction).where(
                UniversityInteraction.university_id == university_id,
                UniversityInteraction.product_id == product_id,
                UniversityInteraction.contract_number.is_(None),
            )
        matches = list(self.db.scalars(statement).all())
        if len(matches) > 1:
            raise ValueError("ambiguous interaction")
        return matches[0] if matches else None

    def _get_or_create_contract(
        self,
        *,
        interaction_id: UUID,
        number: str,
        signed_at,
        valid_until,
        status: str,
    ) -> Contract:
        contract = self.db.scalar(
            select(Contract).where(Contract.interaction_id == interaction_id, Contract.number == number)
        )
        if contract is None:
            contract = Contract(interaction_id=interaction_id, number=number)
            self.db.add(contract)
        contract.signed_at = signed_at
        contract.valid_until = valid_until
        contract.status = status
        self.db.flush()
        return contract

    def _get_or_create_license(
        self,
        *,
        contract_id: UUID,
        product_id: UUID,
        signed_at,
        valid_until,
        transfer_status: str | None,
    ) -> License:
        license_record = self.db.scalar(
            select(License).where(License.contract_id == contract_id, License.product_id == product_id)
        )
        if license_record is None:
            license_record = License(contract_id=contract_id, product_id=product_id)
            self.db.add(license_record)
        license_record.signed_at = signed_at
        license_record.valid_until = valid_until
        license_record.transfer_status = transfer_status
        self.db.flush()
        return license_record

    def _lock_items(self, items: list[dict]) -> None:
        bind = self.db.get_bind()
        if bind.dialect.name != "postgresql":
            return
        for key in sorted({str(item.get("businessKey") or item.get("business_key")) for item in items}):
            self.db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": f"import:{key}"})

    def _ensure_diff_is_fresh(self, job: ImportJob, items: list[dict]) -> None:
        diff_service = ImportDiffService(self.db)
        expected = job.diff_snapshot or {}
        if expected.get("input_hash") != diff_service.input_hash(job):
            raise import_error("IMPORT_STALE_DIFF", "Import input changed after diff was built", 409)
        if expected.get("mapping_hash") != diff_service.mapping_hash(job):
            raise import_error("IMPORT_STALE_DIFF", "Import mapping changed after diff was built", 409)
        if expected.get("crm_fingerprint") != diff_service.crm_fingerprint(items):
            raise import_error("IMPORT_STALE_DIFF", "CRM data changed after diff was built", 409)

    def _protocol_payload(self, job: ImportJob, result: str) -> dict:
        source = ImportService(self.db)._get_source_file(job)
        return {
            "jobId": str(job.id),
            "sourceChecksum": source.checksum,
            "mapping": job.mapping_snapshot,
            "totalRows": job.total_rows,
            "validRows": job.valid_rows,
            "invalidRows": job.invalid_rows,
            "create": job.create_count,
            "update": job.update_count,
            "skip": job.skip_count,
            "conflict": job.conflict_count,
            "result": result,
            "startedAt": job.started_at.isoformat() if job.started_at else None,
            "finishedAt": job.finished_at.isoformat() if job.finished_at else None,
            "errorCode": job.error_code,
        }

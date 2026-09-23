from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.imports.mapping.registry import normalize_text, normalized_key
from app.modules.imports.mapping.service import import_error
from app.modules.imports.model import ImportJob, ImportRowError
from app.modules.imports.row import parse_datetime
from app.modules.imports.service import ImportService
from app.modules.interactions.model import UniversityInteraction
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
            self.db.commit()
            self.db.refresh(job)
            return job
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
        interaction.license_signed_at = parse_datetime(payload.get("license.signed_at"))
        interaction.license_signed = interaction.license_signed_at is not None
        interaction.license_valid_until = parse_datetime(payload.get("license.valid_until"))
        interaction.transfer_status = normalize_text(payload.get("license.transfer_status"))
        interaction.university_responsibles = normalize_text(payload.get("university_contact.full_name"))
        interaction.comment = normalize_text(payload.get("interaction.comment"))
        self.db.flush()

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
        matches = list(
            self.db.scalars(
                select(UniversityInteraction).where(
                    UniversityInteraction.university_id == university_id,
                    UniversityInteraction.product_id == product_id,
                    UniversityInteraction.contract_number == contract_number,
                )
            ).all()
        )
        if len(matches) > 1:
            raise ValueError("ambiguous interaction")
        return matches[0] if matches else None

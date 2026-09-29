from __future__ import annotations

from datetime import date, datetime, timezone
from pathlib import Path
from uuid import UUID

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.audit.model import AuditEvent
from app.modules.audit.repository import AuditEventRepository
from app.modules.health.service import HealthService
from app.modules.integrations.adapters import (
    AdapterRecord,
    SOURCES,
    normalized_key,
    parse_b2c_user_fixture,
    parse_payment_fixture,
    parse_team_fixture,
    parse_vendor_fixture,
    utcnow,
)
from app.security.pii import encrypt_pii_payload
from app.modules.integrations.model import (
    ExternalCourseMapping,
    ExternalStreamMapping,
    IntegrationSignal,
    ProgramMetric,
)
from app.modules.nba.service import NbaService
from app.modules.organizations.model import Organization
from app.modules.products.model import ITProduct, Vendor, VendorContact
from app.modules.program_instances.model import ProgramInstance
from app.modules.program_instances.model import AcademicWindow
from app.modules.programs.model import ITDirection
from app.core.config import settings
from app.modules.integrations.schemas import LmsEventCreate


class IntegrationSyncService:
    """Canonical processing after a source adapter has parsed a fixture."""

    def __init__(self, db: Session) -> None:
        self.db, self.audit = db, AuditEventRepository(db)

    def metrics(self, program_id: UUID) -> ProgramMetric | None:
        return self.db.scalar(
            select(ProgramMetric).where(ProgramMetric.program_instance_id == program_id)
        )

    def sources_summary(self) -> list[dict[str, object]]:
        result = []
        for source in sorted(SOURCES):
            rows = self.db.execute(
                select(IntegrationSignal.status, func.count())
                .where(IntegrationSignal.source == source)
                .group_by(IntegrationSignal.status)
            )
            counts = {status: count for status, count in rows}
            last_package_at = self.db.scalar(
                select(func.max(IntegrationSignal.received_at)).where(
                    IntegrationSignal.source == source
                )
            )
            result.append(
                {
                    "source": source,
                    "records": sum(counts.values()),
                    "mapped": counts.get("mapped", 0),
                    "unmatched": counts.get("unmatched", 0),
                    "errors": counts.get("error", 0),
                    "last_package_at": last_package_at.isoformat() if last_package_at else None,
                }
            )
        return result

    def packages(self) -> list[dict[str, object]]:
        events = self.db.scalars(
            select(AuditEvent)
            .where(AuditEvent.action == "integration.package.process")
            .order_by(AuditEvent.created_at.desc())
            .limit(100)
        ).all()
        return [
            {
                "source": str(event.event_metadata.get("source", "UNKNOWN")),
                "package_label": event.event_metadata.get("package_label"),
                "processed_at": event.created_at,
                "processed": int(event.event_metadata.get("processed", 0)),
                "mapped": int(event.event_metadata.get("mapped", 0)),
                "unmatched": int(event.event_metadata.get("unmatched", 0)),
                "errors": int(event.event_metadata.get("errors", 0)),
                "ignored": int(event.event_metadata.get("ignored", 0)),
            }
            for event in events
        ]

    def diagnostics(self) -> list[dict[str, object]]:
        grouped: dict[tuple[str, str | None, str | None, str, UUID | None], int] = {}
        for signal in self.db.scalars(select(IntegrationSignal)).all():
            payload = signal.normalized_payload or {}
            key = (
                signal.source,
                payload.get("external_course_name"),
                str(payload.get("external_stream_id"))
                if payload.get("external_stream_id") is not None
                else None,
                signal.status,
                signal.program_instance_id,
            )
            grouped[key] = grouped.get(key, 0) + 1
        result = []
        for (source, course, stream, status, program_id), records in grouped.items():
            program = self.db.get(ProgramInstance, program_id) if program_id else None
            organization = (
                self.db.get(Organization, program.organization_id) if program else None
            )
            product = self.db.get(ITProduct, program.product_id) if program else None
            result.append(
                {
                    "source": source,
                    "external_course_name": course,
                    "external_stream_id": stream,
                    "status": status,
                    "records": records,
                    "program_instance_id": program_id,
                    "matched_program": f"{organization.name} · {product.name}"
                    if organization and product
                    else None,
                }
            )
        return sorted(
            result,
            key=lambda item: (
                str(item["source"]),
                str(item["external_course_name"]),
                str(item["external_stream_id"]),
                str(item["status"]),
            ),
        )

    def apply_mapping_and_replay(
        self,
        *,
        source: str,
        course: str,
        stream: str,
        program_id: UUID,
        actor_user_id: UUID | None = None,
    ) -> dict[str, int]:
        program = self.db.get(ProgramInstance, program_id)
        if program is None:
            raise ValueError("Program instance not found")
        course_mapping = self.db.scalar(
            select(ExternalCourseMapping).where(
                ExternalCourseMapping.source == source,
                ExternalCourseMapping.external_course_name == course,
            )
        )
        if course_mapping is None:
            course_mapping = ExternalCourseMapping(
                source=source,
                external_course_name=course,
                direction_id=program.direction_id,
                product_id=program.product_id,
            )
            self.db.add(course_mapping)
        else:
            course_mapping.direction_id = program.direction_id
            course_mapping.product_id = program.product_id
            course_mapping.status = "active"
        stream_mapping = self.db.scalar(
            select(ExternalStreamMapping).where(
                ExternalStreamMapping.source == source,
                ExternalStreamMapping.external_course_name == course,
                ExternalStreamMapping.external_stream_id == stream,
            )
        )
        if stream_mapping is None:
            stream_mapping = ExternalStreamMapping(
                source=source,
                external_course_name=course,
                external_stream_id=stream,
                program_instance_id=program.id,
            )
            self.db.add(stream_mapping)
        else:
            stream_mapping.program_instance_id = program.id
        self.db.flush()
        records = list(
            self.db.scalars(
                select(IntegrationSignal).where(
                    IntegrationSignal.source == source,
                    IntegrationSignal.status == "unmatched",
                    IntegrationSignal.normalized_payload["external_course_name"].astext
                    == course,
                    IntegrationSignal.normalized_payload["external_stream_id"].astext
                    == stream,
                )
            ).all()
        )
        mapped = 0
        for signal in records:
            if self._match(signal) is not None:
                signal.status = "mapped"
                signal.program_instance_id = program.id
                signal.organization_id = program.organization_id
                signal.match_reason = "manual mapping replay"
                mapped += 1
        if mapped:
            self.recompute_metrics(program.id)
        self.audit.add(
            AuditEvent(
                actor_user_id=actor_user_id,
                action="integration.mapping.apply_and_replay",
                entity_type="external_stream_mapping",
                entity_id=stream_mapping.id,
                event_metadata={
                    "source": source,
                    "course": course,
                    "stream": stream,
                    "program_id": str(program.id),
                    "mapped": mapped,
                },
            )
        )
        self.db.commit()
        return {"replayed": len(records), "mapped": mapped}

    def process_fixture(
        self,
        source: str,
        actor_user_id: UUID | None = None,
        file_path: Path | None = None,
        package_label: str | None = None,
    ) -> dict[str, int]:
        if source not in SOURCES:
            raise ValueError("Unsupported integration source")
        counts = {
            "processed": 0,
            "mapped": 0,
            "unmatched": 0,
            "errors": 0,
            "ignored": 0,
        }
        affected: set[UUID] = set()
        for record in self._adapter_records(source, file_path):
            signal, created = self._upsert_signal(record)
            if not created:
                counts["ignored"] += 1
                continue
            counts["processed"] += 1
            try:
                declared_status = (
                    record.raw_payload.get("status")
                    if source in {"WEBSITE", "LMS"}
                    else None
                )
                if declared_status == "error":
                    signal.status = "error"
                    signal.error_code = "TEAM_FIXTURE_ERROR"
                    signal.error_message = str(
                        record.raw_payload.get("error_message") or "Team fixture error"
                    )
                elif source == "VENDOR_CATALOG":
                    self._apply_vendor(signal)
                    signal.status, signal.match_reason = (
                        "mapped",
                        "vendor catalog upsert",
                    )
                else:
                    if source == "PAYMENT":
                        self._link_b2c_user(signal)
                    program = self._match(signal)
                    if program is None:
                        signal.status, signal.match_reason = (
                            "unmatched",
                            "no explicit program mapping",
                        )
                    else:
                        (
                            signal.status,
                            signal.program_instance_id,
                            signal.organization_id,
                        ) = "mapped", program.id, program.organization_id
                        affected.add(program.id)
                counts[signal.status] += 1
            except Exception as exc:
                signal.status, signal.error_code, signal.error_message = (
                    "error",
                    "PROCESSING_ERROR",
                    str(exc)[:500],
                )
                counts["errors"] += 1
        for program_id in affected:
            self.recompute_metrics(program_id)
        self.audit.add(
            AuditEvent(
                actor_user_id=actor_user_id,
                action="integration.package.process",
                entity_type="integration_source",
                event_metadata={"source": source, "package_label": package_label, **counts},
            )
        )
        self.db.commit()
        return counts

    def replay(
        self,
        source: str,
        external_course_name: str,
        external_stream_id: str,
        actor_user_id: UUID | None = None,
    ) -> dict[str, int]:
        records = list(
            self.db.scalars(
                select(IntegrationSignal).where(
                    IntegrationSignal.source == source,
                    IntegrationSignal.status == "unmatched",
                    IntegrationSignal.normalized_payload["external_course_name"].astext
                    == external_course_name,
                    IntegrationSignal.normalized_payload["external_stream_id"].astext
                    == external_stream_id,
                )
            ).all()
        )
        affected: set[UUID] = set()
        mapped = 0
        for signal in records:
            if program := self._match(signal):
                signal.status, signal.program_instance_id, signal.organization_id = (
                    "mapped",
                    program.id,
                    program.organization_id,
                )
                signal.match_reason = "manual stream mapping replay"
                affected.add(program.id)
                mapped += 1
        for program_id in affected:
            self.recompute_metrics(program_id)
        self.audit.add(
            AuditEvent(
                actor_user_id=actor_user_id,
                action="integration.replay",
                entity_type="integration_mapping",
                event_metadata={
                    "source": source,
                    "course": external_course_name,
                    "stream": external_stream_id,
                    "mapped": mapped,
                },
            )
        )
        self.db.commit()
        return {"replayed": len(records), "mapped": mapped}

    def create_stream_mapping(
        self,
        *,
        source: str,
        course: str,
        stream: str,
        program_id: UUID,
        actor_user_id: UUID | None = None,
    ) -> ExternalStreamMapping:
        mapping = self.db.scalar(
            select(ExternalStreamMapping).where(
                ExternalStreamMapping.source == source,
                ExternalStreamMapping.external_course_name == course,
                ExternalStreamMapping.external_stream_id == stream,
            )
        )
        action = "integration.mapping.change"
        if mapping is None:
            mapping = ExternalStreamMapping(
                source=source,
                external_course_name=course,
                external_stream_id=stream,
                program_instance_id=program_id,
            )
            self.db.add(mapping)
            action = "integration.mapping.create"
        else:
            mapping.program_instance_id = program_id
        self.db.flush()
        self.audit.add(
            AuditEvent(
                actor_user_id=actor_user_id,
                action=action,
                entity_type="external_stream_mapping",
                entity_id=mapping.id,
                event_metadata={
                    "source": source,
                    "course": course,
                    "stream": stream,
                    "program_id": str(program_id),
                },
            )
        )
        self.db.commit()
        self.db.refresh(mapping)
        return mapping

    def create_course_mapping(
        self,
        *,
        source: str,
        course: str,
        direction_id: UUID | None,
        product_id: UUID | None,
        actor_user_id: UUID | None = None,
    ) -> ExternalCourseMapping:
        mapping = self.db.scalar(
            select(ExternalCourseMapping).where(
                ExternalCourseMapping.source == source,
                ExternalCourseMapping.external_course_name == course,
            )
        )
        action = "integration.mapping.change"
        if mapping is None:
            mapping = ExternalCourseMapping(
                source=source,
                external_course_name=course,
                direction_id=direction_id,
                product_id=product_id,
            )
            self.db.add(mapping)
            action = "integration.mapping.create"
        else:
            mapping.direction_id, mapping.product_id = direction_id, product_id
        self.db.flush()
        self.audit.add(
            AuditEvent(
                actor_user_id=actor_user_id,
                action=action,
                entity_type="external_course_mapping",
                entity_id=mapping.id,
            )
        )
        self.db.commit()
        self.db.refresh(mapping)
        return mapping

    def recompute_metrics(self, program_id: UUID) -> ProgramMetric:
        metric = self.metrics(program_id)
        if metric is None:
            metric = ProgramMetric(program_instance_id=program_id)
            self.db.add(metric)
            self.db.flush()
        signals = list(
            self.db.scalars(
                select(IntegrationSignal)
                .where(
                    IntegrationSignal.program_instance_id == program_id,
                    IntegrationSignal.status == "mapped",
                )
                .order_by(IntegrationSignal.received_at)
            ).all()
        )
        website, lms = (
            [s for s in signals if s.source == "WEBSITE"],
            [s for s in signals if s.source == "LMS"],
        )
        payments = [s for s in signals if s.source == "PAYMENT"]
        if website:
            payload = website[-1].normalized_payload
            metric.applications_count, metric.last_website_signal_at = (
                int(
                    payload.get("applications_count", payload.get("applications", 0))
                    or 0
                ),
                website[-1].received_at,
            )
        if lms:
            payload = lms[-1].normalized_payload
            metric.students_count, metric.streams_count = (
                int(payload.get("students_count", payload.get("students", 0)) or 0),
                int(payload.get("streams_count", payload.get("streams", 0)) or 0),
            )
            if payload.get("teacher_activity_on"):
                metric.teacher_activity_on = date.fromisoformat(
                    str(payload["teacher_activity_on"])
                )
            metric.last_lms_signal_at = lms[-1].received_at
        (
            metric.payment_records_count,
            metric.last_payment_signal_at,
            metric.synced_at,
        ) = len(payments), (payments[-1].received_at if payments else None), utcnow()
        HealthService(self.db).recompute(program_id)
        NbaService(self.db).recompute_program(program_id)
        return metric

    def sync_program(self, program_id: UUID) -> dict[str, object]:
        """Backward-compatible deterministic team-stub sync for the existing program API."""
        program = self.db.get(ProgramInstance, program_id)
        if program is None:
            raise ValueError("Program not found")
        counts = {"mapped": 0, "unmatched": 0, "errors": 0}
        organization = self.db.get(Organization, program.organization_id)
        for source in ("WEBSITE", "LMS"):
            for record in self._adapter_records(source):
                signal, created = self._upsert_signal(record)
                if not created:
                    continue
                matched = self._match(signal)
                if matched and matched.id == program_id:
                    (
                        signal.status,
                        signal.program_instance_id,
                        signal.organization_id,
                    ) = "mapped", program.id, program.organization_id
                elif (
                    organization
                    and signal.normalized_payload.get("organization_name")
                    == organization.name
                ):
                    signal.status = "unmatched"
                else:
                    continue
                counts[signal.status] += 1
        metric = self.recompute_metrics(program_id)
        self.db.commit()
        self.db.refresh(metric)
        return {**counts, "metrics": metric}

    def send_program_to_lms(self, program_id: UUID, actor_user_id: UUID) -> dict[str, object]:
        if not settings.lms_mock_enabled or not settings.lms_service_token:
            raise ValueError("Mock LMS is disabled or LMS_SERVICE_TOKEN is not configured")
        program = self.db.get(ProgramInstance, program_id)
        if program is None:
            raise ValueError("Program not found")
        organization = self.db.get(Organization, program.organization_id)
        direction = self.db.get(ITDirection, program.direction_id)
        product = self.db.get(ITProduct, program.product_id)
        window = self.db.get(AcademicWindow, program.academic_window_id) if program.academic_window_id else None
        payload = {
            "program_instance_id": str(program.id),
            "organization": organization.name if organization else None,
            "program": {"direction": direction.name if direction else None, "product": product.name if product else None},
            "stream": window.title if window else None,
            "dates": {"start": window.classes_start_on.isoformat() if window else None, "end": window.classes_end_on.isoformat() if window else None},
        }
        try:
            response = httpx.post(
                f"{settings.lms_base_url.rstrip('/')}/api/programs",
                json=payload,
                headers={"X-LMS-Service-Token": settings.lms_service_token},
                timeout=10,
            )
            response.raise_for_status()
            external_lms_id = str(response.json()["external_id"])
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            program.lms_sync_status = "FAILED"
            self.audit.add(AuditEvent(actor_user_id=actor_user_id, action="integration.lms.send", entity_type="program_instance", entity_id=program.id, result="FAILURE", error_code="LMS_UNAVAILABLE", reason=str(exc)[:500]))
            self.db.commit()
            raise ValueError("Mock LMS is unavailable") from exc
        program.external_lms_id = external_lms_id
        program.lms_sync_status = "SYNCED"
        program.last_lms_sync_at = datetime.now(timezone.utc)
        self.audit.add(AuditEvent(actor_user_id=actor_user_id, action="integration.lms.send", entity_type="program_instance", entity_id=program.id, result="SUCCESS", event_metadata={"external_lms_id": external_lms_id}))
        self.db.commit()
        return {"external_lms_id": external_lms_id, "status": program.lms_sync_status, "last_lms_sync_at": program.last_lms_sync_at}

    def receive_lms_event(self, event: LmsEventCreate) -> dict[str, object]:
        existing = self.db.scalar(select(IntegrationSignal).where(IntegrationSignal.source == "LMS", IntegrationSignal.external_key == event.event_id))
        if existing is not None:
            return {"status": "ignored", "signal_id": str(existing.id)}
        program = self.db.scalar(select(ProgramInstance).where(ProgramInstance.external_lms_id == event.external_program_id))
        student_count = event.data.get("student_count")
        normalized = {"external_program_id": event.external_program_id, "event_type": event.type}
        if student_count is not None:
            normalized["students_count"] = int(student_count)
        signal = IntegrationSignal(source="LMS", external_key=event.event_id, received_at=datetime.now(timezone.utc), status="mapped" if program else "unmatched", organization_id=program.organization_id if program else None, program_instance_id=program.id if program else None, payload=encrypt_pii_payload(event.model_dump()), normalized_payload=normalized, match_reason="external_lms_id" if program else "external_lms_id_not_found")
        self.db.add(signal)
        if program is not None:
            metric = self.metrics(program.id)
            if metric is None:
                metric = ProgramMetric(program_instance_id=program.id)
                self.db.add(metric)
            if "students_count" in normalized:
                metric.students_count = normalized["students_count"]
            metric.last_lms_signal_at = signal.received_at
            metric.synced_at = signal.received_at
            self.audit.add(AuditEvent(actor_user_id=None, action="integration.lms.event", entity_type="program_instance", entity_id=program.id, result="SUCCESS", event_metadata={"event_id": event.event_id, "type": event.type}))
        else:
            self.audit.add(AuditEvent(actor_user_id=None, action="integration.lms.event", entity_type="integration_signal", entity_id=signal.id, result="UNMATCHED", event_metadata={"event_id": event.event_id}))
        self.db.commit()
        return {"status": signal.status, "signal_id": str(signal.id), "program_instance_id": str(program.id) if program else None}

    def _adapter_records(
        self, source: str, file_path: Path | None = None
    ) -> list[AdapterRecord]:
        if source in {"VENDOR_CATALOG", "B2C_USER", "PAYMENT"} and file_path is None:
            raise ValueError("An uploaded fixture file is required for this source")
        if source == "VENDOR_CATALOG":
            return parse_vendor_fixture(file_path)
        if source == "B2C_USER":
            return parse_b2c_user_fixture(file_path)
        if source == "PAYMENT":
            return parse_payment_fixture(file_path)
        return parse_team_fixture(source, file_path)

    @staticmethod
    def _fixture_signals() -> list[dict]:
        """Compatibility accessor for the existing team-stub contract."""
        return [
            record.raw_payload
            for source in ("WEBSITE", "LMS")
            for record in parse_team_fixture(source)
        ]

    def _upsert_signal(self, record: AdapterRecord) -> tuple[IntegrationSignal, bool]:
        existing = self.db.scalar(
            select(IntegrationSignal).where(
                IntegrationSignal.source == record.source,
                IntegrationSignal.external_key == record.external_key,
            )
        )
        if existing:
            return existing, False
        signal = IntegrationSignal(
            source=record.source,
            external_key=record.external_key,
            received_at=datetime.now(timezone.utc),
            status="received",
            payload=encrypt_pii_payload(record.raw_payload),
            normalized_payload=record.normalized_payload,
        )
        self.db.add(signal)
        self.db.flush()
        return signal, True

    def _apply_vendor(self, signal: IntegrationSignal) -> None:
        payload = signal.normalized_payload
        vendor = self.db.scalar(
            select(Vendor).where(Vendor.business_key == payload["vendor_key"])
        ) or self.db.scalar(
            select(Vendor).where(func.lower(Vendor.name) == payload["vendor_key"])
        )
        if vendor is None:
            vendor = Vendor(
                name=payload["vendor_name"], business_key=payload["vendor_key"]
            )
            self.db.add(vendor)
            self.db.flush()
        else:
            vendor.name, vendor.business_key = (
                payload["vendor_name"],
                payload["vendor_key"],
            )
        business_key = f"{payload['vendor_key']}:{payload['product_key']}"
        product = self.db.scalar(
            select(ITProduct).where(ITProduct.business_key == business_key)
        )
        if product is None:
            product = ITProduct(
                name=payload["product_name"],
                vendor_id=vendor.id,
                business_key=business_key,
            )
            self.db.add(product)
            self.db.flush()
        else:
            product.name, product.vendor_id = payload["product_name"], vendor.id
        if contact_key := normalized_key(payload.get("contact_name")):
            contact = self.db.scalar(
                select(VendorContact).where(
                    VendorContact.vendor_id == vendor.id,
                    VendorContact.business_key == contact_key,
                )
            )
            if contact is None:
                contact = VendorContact(
                    vendor_id=vendor.id,
                    product_id=product.id,
                    business_key=contact_key,
                    full_name=payload["contact_name"],
                )
                self.db.add(contact)
            (
                contact.product_id,
                contact.full_name,
                contact.phone,
                contact.email,
                contact.preferred_channel,
            ) = (
                product.id,
                payload["contact_name"],
                payload.get("phone"),
                payload.get("email"),
                payload.get("preferred_channel"),
            )

    def _link_b2c_user(self, signal: IntegrationSignal) -> None:
        """Link a payment row to staging identity by email, then phone; never by name alone."""
        payload = signal.normalized_payload
        candidates: list[IntegrationSignal] = []
        for field in ("email_hash", "phone_hash"):
            value = payload.get(field)
            if value:
                candidates = list(
                    self.db.scalars(
                        select(IntegrationSignal).where(
                            IntegrationSignal.source == "B2C_USER",
                            IntegrationSignal.normalized_payload[field].astext == value,
                        )
                    ).all()
                )
                if candidates:
                    break
        if len(candidates) != 1:
            return
        candidate = candidates[0]
        candidate_name = candidate.normalized_payload.get("full_name")
        if (
            candidate_name
            and payload.get("full_name")
            and normalized_key(candidate_name) != normalized_key(payload["full_name"])
        ):
            return
        payload["b2c_person_key"] = candidate.normalized_payload.get(
            "external_person_key"
        )
        payload["person_match"] = "email_or_phone"
        signal.normalized_payload = payload

    def _match(self, signal: IntegrationSignal) -> ProgramInstance | None:
        payload = signal.normalized_payload
        if signal.source in {"WEBSITE", "LMS"}:
            organization = self.db.scalar(
                select(Organization).where(
                    Organization.name == payload.get("organization_name")
                )
            )
            product = self.db.scalar(
                select(ITProduct).where(ITProduct.name == payload.get("product_name"))
            )
            if organization and product:
                programs = list(
                    self.db.scalars(
                        select(ProgramInstance).where(
                            ProgramInstance.organization_id == organization.id,
                            ProgramInstance.product_id == product.id,
                            ProgramInstance.status == "active",
                        )
                    ).all()
                )
                return programs[0] if len(programs) == 1 else None
            return None
        if signal.source != "PAYMENT":
            return None
        course, stream = (
            payload.get("external_course_name"),
            payload.get("external_stream_id"),
        )
        if not course or not stream:
            return None
        course_mapping = self.db.scalar(
            select(ExternalCourseMapping).where(
                ExternalCourseMapping.source == "PAYMENT",
                ExternalCourseMapping.external_course_name == course,
                ExternalCourseMapping.status == "active",
            )
        )
        stream_mapping = self.db.scalar(
            select(ExternalStreamMapping).where(
                ExternalStreamMapping.source == "PAYMENT",
                ExternalStreamMapping.external_course_name == course,
                ExternalStreamMapping.external_stream_id == stream,
            )
        )
        if course_mapping is None or stream_mapping is None:
            return None
        program = self.db.get(ProgramInstance, stream_mapping.program_instance_id)
        if (
            program
            and (
                course_mapping.product_id is None
                or program.product_id == course_mapping.product_id
            )
            and (
                course_mapping.direction_id is None
                or program.direction_id == course_mapping.direction_id
            )
        ):
            return program
        return None

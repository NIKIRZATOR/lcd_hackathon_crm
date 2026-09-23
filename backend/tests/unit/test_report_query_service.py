from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.dialects import postgresql

from app.modules.reports.query_service import ReportQueryService
from app.modules.reports.read_models import ReportRow
from app.modules.reports.schemas import ReportFilter
from app.modules.users.model import Role, User


def make_user(*roles: str) -> User:
    return User(
        id=uuid4(),
        keycloak_user_id=uuid4(),
        username="report-user",
        full_name="Report User",
        email="report-user@example.local",
        role=roles[0] if roles else "USER",
        is_active=True,
        roles=[Role(id=uuid4(), name=role, description=f"{role} role") for role in roles],
    )


def compile_sql(statement) -> str:
    return str(statement.compile(dialect=postgresql.dialect()))


def test_report_query_applies_filters_and_uses_normalized_tables() -> None:
    service = ReportQueryService(db=None)
    report_filter = ReportFilter(
        date_from=datetime(2026, 1, 1, tzinfo=timezone.utc),
        date_to=datetime(2026, 12, 31, tzinfo=timezone.utc),
        university_ids=[uuid4()],
        direction_ids=[uuid4()],
        product_ids=[uuid4()],
        interaction_statuses=["ACTIVE"],
        sort_by="university_name",
        sort_direction="asc",
    )

    sql = compile_sql(service.build_query(report_filter, make_user("ADMIN")))

    assert "JOIN universities" in sql
    assert "JOIN it_programs" in sql
    assert "LEFT OUTER JOIN contracts" in sql
    assert "LEFT OUTER JOIN licenses" in sql
    assert "university_interactions.started_at >=" in sql
    assert "university_interactions.started_at <=" in sql
    assert "university_interactions.university_id IN" in sql
    assert "it_programs.direction_id IN" in sql
    assert "university_interactions.product_id IN" in sql
    assert "university_interactions.status IN" in sql
    assert "ORDER BY universities.name ASC" in sql


def test_report_query_applies_kam_scope_with_explicit_acl() -> None:
    service = ReportQueryService(db=None)

    sql = compile_sql(service.build_query(ReportFilter(), make_user("KAM")))

    assert "university_interactions.manager_user_id IN" in sql
    assert "EXISTS" in sql
    assert "data_access_scopes" in sql
    assert "data_access_scopes.subject_user_id" in sql
    assert "data_access_scopes.interaction_id = university_interactions.id" in sql
    assert "data_access_scopes.university_id = university_interactions.university_id" in sql


def test_report_query_applies_manager_subordinate_scope(monkeypatch) -> None:
    subordinate_id = uuid4()
    monkeypatch.setattr(
        "app.modules.reports.query_service.get_subordinate_kam_ids",
        lambda db, manager_user_id: {subordinate_id},
    )
    service = ReportQueryService(db=None)

    sql = compile_sql(service.build_query(ReportFilter(), make_user("MANAGER")))

    assert "university_interactions.manager_user_id IN" in sql
    assert "data_access_scopes" in sql


def test_report_query_denies_unknown_role_by_false_condition() -> None:
    service = ReportQueryService(db=None)

    sql = compile_sql(service.build_query(ReportFilter(), make_user("VIEWER")))

    assert "WHERE false" in sql


def test_preview_and_fetch_rows_use_same_dataset() -> None:
    now = datetime.now(timezone.utc)
    row = {
        "interaction_id": uuid4(),
        "university_id": uuid4(),
        "university_name": "RTK Demo University",
        "direction_id": uuid4(),
        "direction_name": "AI",
        "program_id": uuid4(),
        "program_name": "Applied AI",
        "product_id": uuid4(),
        "product_name": "Demo Product",
        "vendor_id": uuid4(),
        "vendor_name": "Demo Vendor",
        "contract_id": None,
        "contract_number": None,
        "contract_signed_at": None,
        "contract_valid_from": None,
        "contract_valid_until": None,
        "license_id": None,
        "license_number": None,
        "license_signed_at": None,
        "license_valid_until": None,
        "transfer_status": None,
        "responsible_user_id": uuid4(),
        "responsible_name": "KAM User",
        "interaction_status": "ACTIVE",
        "workflow_stage_id": None,
        "workflow_stage_name": None,
        "workflow_stage_status": None,
        "comment": None,
        "started_at": now,
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }

    class FakeMappings:
        def all(self):
            return [row]

    class FakeResult:
        def mappings(self):
            return FakeMappings()

    class FakeDb:
        def __init__(self) -> None:
            self.executed = []

        def scalar(self, statement):
            self.count_statement = statement
            return 1

        def execute(self, statement):
            self.executed.append(statement)
            return FakeResult()

    db = FakeDb()
    service = ReportQueryService(db)
    report_filter = ReportFilter(interaction_statuses=["ACTIVE"])
    user = make_user("ADMIN")

    preview = service.preview(report_filter, user, limit=20, offset=0)
    exported_rows = service.fetch_rows(report_filter, user)

    assert preview.total == 1
    assert preview.items == exported_rows
    assert len(db.executed) == 2


def test_fetch_rows_maps_canonical_report_rows() -> None:
    now = datetime.now(timezone.utc)
    row = {
        "interaction_id": uuid4(),
        "university_id": uuid4(),
        "university_name": "RTK Demo University",
        "direction_id": uuid4(),
        "direction_name": "AI",
        "program_id": uuid4(),
        "program_name": "Applied AI",
        "product_id": uuid4(),
        "product_name": "Demo Product",
        "vendor_id": uuid4(),
        "vendor_name": "Demo Vendor",
        "contract_id": uuid4(),
        "contract_number": "RTK-DEMO-001",
        "contract_signed_at": now,
        "contract_valid_from": now,
        "contract_valid_until": now,
        "license_id": uuid4(),
        "license_number": "LIC-001",
        "license_signed_at": now,
        "license_valid_until": now,
        "transfer_status": "TRANSFERRED",
        "responsible_user_id": uuid4(),
        "responsible_name": "KAM User",
        "interaction_status": "ACTIVE",
        "workflow_stage_id": uuid4(),
        "workflow_stage_name": "Negotiation",
        "workflow_stage_status": "IN_PROGRESS",
        "comment": "Looks good",
        "started_at": now,
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }

    class FakeMappings:
        def all(self):
            return [row]

    class FakeResult:
        def mappings(self):
            return FakeMappings()

    class FakeDb:
        def execute(self, statement):
            self.statement = statement
            return FakeResult()

    db = FakeDb()
    rows = ReportQueryService(db).fetch_rows(ReportFilter(), make_user("ADMIN"), limit=10, offset=0)

    assert len(rows) == 1
    assert isinstance(rows[0], ReportRow)
    assert rows[0].interaction_id == row["interaction_id"]
    assert rows[0].contract_number == "RTK-DEMO-001"
    assert rows[0].license_number == "LIC-001"

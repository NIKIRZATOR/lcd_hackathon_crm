from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.modules.organizations.schemas import BulkAssignmentCreate
from app.modules.organizations.service import OrganizationService
from app.modules.users.model import User


class ScalarRows:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeDatabase:
    def __init__(self, target_kam, interaction, scalar_rows):
        self.target_kam = target_kam
        self.interaction = interaction
        self.scalar_rows = iter(scalar_rows)
        self.added = []
        self.commits = 0

    def get(self, model, entity_id):
        if model is User:
            return self.target_kam
        if entity_id == self.interaction.id:
            return self.interaction
        return None

    def scalars(self, _statement):
        return ScalarRows(next(self.scalar_rows))

    def add(self, value):
        self.added.append(value)

    def flush(self):
        return None

    def commit(self):
        self.commits += 1

    def refresh(self, _value):
        return None


def test_bulk_reassignment_moves_inherited_program_and_workflow_owner(monkeypatch) -> None:
    manager_id, source_kam_id, target_kam_id = uuid4(), uuid4(), uuid4()
    organization_id, program_id, interaction_id = uuid4(), uuid4(), uuid4()
    manager = SimpleNamespace(id=manager_id, roles=[SimpleNamespace(name="MANAGER")])
    target_kam = SimpleNamespace(id=target_kam_id, roles=[SimpleNamespace(name="KAM")])
    organization = SimpleNamespace(id=organization_id)
    assignment = SimpleNamespace(
        organization_id=organization_id,
        user_id=source_kam_id,
        status="active",
        ended_at=None,
    )
    program = SimpleNamespace(
        id=program_id,
        organization_id=organization_id,
        kam_user_id=source_kam_id,
        legacy_interaction_id=interaction_id,
    )
    custom_kam_id = uuid4()
    separately_assigned_program = SimpleNamespace(
        id=uuid4(),
        organization_id=organization_id,
        kam_user_id=custom_kam_id,
        legacy_interaction_id=None,
    )
    interaction = SimpleNamespace(
        id=interaction_id,
        manager_user_id=source_kam_id,
    )
    stage = SimpleNamespace(program_instance_id=program_id, responsible_user_id=source_kam_id)
    db = FakeDatabase(
        target_kam,
        interaction,
        [[organization], [assignment], [program, separately_assigned_program], [interaction], [stage]],
    )
    monkeypatch.setattr(
        "app.modules.organizations.service.get_subordinate_kam_ids",
        lambda *_args: {source_kam_id, target_kam_id},
    )

    result = OrganizationService(db).assign_many(
        BulkAssignmentCreate(
            organization_ids=[organization_id],
            kam_user_id=target_kam_id,
            reason="Балансировка нагрузки",
        ),
        manager,
    )

    assert assignment.status == "ended"
    assert assignment.ended_at <= datetime.now(timezone.utc)
    assert program.kam_user_id == target_kam_id
    assert separately_assigned_program.kam_user_id == custom_kam_id
    assert interaction.manager_user_id == target_kam_id
    assert stage.responsible_user_id == target_kam_id
    assert result["reassigned_programs"] == 1
    assert result["assignments"][0].user_id == target_kam_id
    assert db.commits == 1

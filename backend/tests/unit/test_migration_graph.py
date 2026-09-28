from alembic.config import Config
from alembic.script import ScriptDirectory


def test_merged_workflow_and_logo_migrations_have_one_head() -> None:
    config = Config("alembic.ini")
    script = ScriptDirectory.from_config(config)

    assert script.get_heads() == ["f2a3b4c5d6e7"]

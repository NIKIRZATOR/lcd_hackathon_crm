from alembic.config import Config
from alembic.script import ScriptDirectory


def test_migrations_have_one_current_head() -> None:
    config = Config("alembic.ini")
    script = ScriptDirectory.from_config(config)

    assert script.get_heads() == ["b3c4d5e6f7a8"]

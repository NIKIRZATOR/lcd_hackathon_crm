"""Verify fresh and published-legacy Alembic upgrade paths on temporary databases."""

from __future__ import annotations

from uuid import uuid4

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from app.core.config import settings


LEGACY_HEAD = "c8a7d5e2f901"
REQUIRED_TABLES = {
    "organizations",
    "program_instances",
    "program_checklist_values",
    "nba_items",
    "integration_signals",
}


def _create_database(admin_engine, database_name: str) -> None:
    with admin_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text(f'CREATE DATABASE "{database_name}"'))


def _drop_database(admin_engine, database_name: str) -> None:
    with admin_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(
            text(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = :database_name AND pid <> pg_backend_pid()"
            ),
            {"database_name": database_name},
        )
        connection.execute(text(f'DROP DATABASE IF EXISTS "{database_name}"'))


def _seed_legacy_fixture(database_url: str) -> None:
    identifiers = {name: uuid4() for name in ("user", "university", "direction", "vendor", "product", "program", "template", "version", "interaction")}
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO users (id, full_name, role, is_active) VALUES (:id, 'Legacy KAM', 'KAM', true)"), {"id": identifiers["user"]})
            connection.execute(text("INSERT INTO universities (id, name, is_active) VALUES (:id, 'Legacy University', true)"), {"id": identifiers["university"]})
            connection.execute(text("INSERT INTO it_directions (id, name, is_active) VALUES (:id, 'Legacy Direction', true)"), {"id": identifiers["direction"]})
            connection.execute(text("INSERT INTO vendors (id, name, is_active) VALUES (:id, 'Legacy Vendor', true)"), {"id": identifiers["vendor"]})
            connection.execute(text("INSERT INTO it_products (id, vendor_id, name, is_active) VALUES (:id, :vendor_id, 'Legacy Product', true)"), {"id": identifiers["product"], "vendor_id": identifiers["vendor"]})
            connection.execute(text("INSERT INTO it_programs (id, direction_id, name, is_active) VALUES (:id, :direction_id, 'Legacy Program', true)"), {"id": identifiers["program"], "direction_id": identifiers["direction"]})
            connection.execute(text("INSERT INTO workflow_templates (id, name, is_active, is_default) VALUES (:id, 'Legacy Playbook', true, true)"), {"id": identifiers["template"]})
            connection.execute(text("INSERT INTO workflow_versions (id, workflow_template_id, version, status) VALUES (:id, :template_id, 1, 'PUBLISHED')"), {"id": identifiers["version"], "template_id": identifiers["template"]})
            connection.execute(
                text(
                    "INSERT INTO university_interactions "
                    "(id, university_id, program_id, product_id, manager_user_id, workflow_template_id, workflow_version_id, status, license_signed) "
                    "VALUES (:id, :university_id, :program_id, :product_id, :manager_user_id, :template_id, :version_id, 'ACTIVE', false)"
                ),
                {
                    "id": identifiers["interaction"],
                    "university_id": identifiers["university"],
                    "program_id": identifiers["program"],
                    "product_id": identifiers["product"],
                    "manager_user_id": identifiers["user"],
                    "template_id": identifiers["template"],
                    "version_id": identifiers["version"],
                },
            )
    finally:
        engine.dispose()


def _verify(database_url: str, *, expect_backfill: bool) -> None:
    engine = create_engine(database_url)
    try:
        schema = inspect(engine)
        missing = REQUIRED_TABLES - set(schema.get_table_names())
        if missing:
            raise RuntimeError(f"Missing target tables: {sorted(missing)}")
        with engine.connect() as connection:
            current = MigrationContext.configure(connection).get_current_revision()
        if current != "b4d6f8a0c2e1":
            raise RuntimeError(f"Unexpected migration revision: {current}")
        if expect_backfill:
            with engine.connect() as connection:
                organizations = connection.scalar(text("SELECT count(*) FROM organizations"))
                programs = connection.scalar(text("SELECT count(*) FROM program_instances"))
            if organizations != 1 or programs != 1:
                raise RuntimeError(
                    f"Legacy backfill failed: organizations={organizations}, programs={programs}"
                )
    finally:
        engine.dispose()


def _run_scenario(admin_engine, base_url, *, from_legacy: bool) -> None:
    suffix = "legacy" if from_legacy else "fresh"
    database_name = f"rtk_migration_{suffix}_{uuid4().hex[:10]}"
    database_url = base_url.set(database=database_name).render_as_string(
        hide_password=False
    )
    _create_database(admin_engine, database_name)
    try:
        config = Config("alembic.ini")
        config.attributes["database_url"] = database_url
        if from_legacy:
            command.upgrade(config, LEGACY_HEAD)
            _seed_legacy_fixture(database_url)
        command.upgrade(config, "head")
        _verify(database_url, expect_backfill=from_legacy)
        print(f"{suffix}: OK")
    finally:
        _drop_database(admin_engine, database_name)


def main() -> None:
    base_url = make_url(settings.database_url)
    admin_engine = create_engine(base_url.set(database="postgres"))
    try:
        _run_scenario(admin_engine, base_url, from_legacy=False)
        _run_scenario(admin_engine, base_url, from_legacy=True)
    finally:
        admin_engine.dispose()


if __name__ == "__main__":
    main()

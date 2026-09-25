"""baseline_schema

Revision ID: 4e2cb764e196
Revises: c8a7d5e2f901
Create Date: 2026-09-24 07:49:03.275350

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '4e2cb764e196'
down_revision: str | None = "c8a7d5e2f901"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    inspector = sa.inspect(op.get_bind())
    if column.name not in {item["name"] for item in inspector.get_columns(table_name)}:
        op.add_column(table_name, column)


def _upgrade_from_legacy() -> None:
    """Bridge the published legacy head to the V2 schema without recreating legacy tables."""
    from app.core.database import Base
    import app.models  # noqa: F401

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    target_tables = (
        "academic_windows",
        "organization_types",
        "workflow_phases",
        "organizations",
        "workflow_stage_catalog",
        "org_assignments",
        "program_instances",
        "stakeholders",
        "playbook_checklist_items",
        "program_checklist_values",
        "teacher_carriers",
        "nba_rules",
        "nba_items",
        "program_metrics",
        "integration_signals",
    )
    for table_name in target_tables:
        if not inspector.has_table(table_name):
            Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)
            inspector = sa.inspect(bind)

    _add_column_if_missing("workflow_templates", sa.Column("code", sa.String(64), nullable=True))
    _add_column_if_missing(
        "workflow_templates",
        sa.Column("applies_to_type", sa.String(32), nullable=False, server_default="all"),
    )
    _add_column_if_missing(
        "workflow_templates",
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
    )
    _add_column_if_missing("workflow_stages", sa.Column("stage_catalog_id", sa.UUID(), nullable=True))

    _add_column_if_missing("contracts", sa.Column("organization_id", sa.UUID(), nullable=True))
    _add_column_if_missing("contracts", sa.Column("signed_on", sa.Date(), nullable=True))
    _add_column_if_missing("contracts", sa.Column("attachment_id", sa.UUID(), nullable=True))
    _add_column_if_missing("contracts", sa.Column("comment", sa.Text(), nullable=True))
    _add_column_if_missing("licenses", sa.Column("program_instance_id", sa.UUID(), nullable=True))
    _add_column_if_missing("licenses", sa.Column("transferred_on", sa.Date(), nullable=True))
    _add_column_if_missing("licenses", sa.Column("attachment_id", sa.UUID(), nullable=True))
    _add_column_if_missing("licenses", sa.Column("comment", sa.Text(), nullable=True))
    _add_column_if_missing("workflow_stage_instances", sa.Column("program_instance_id", sa.UUID(), nullable=True))
    _add_column_if_missing("workflow_transition_history", sa.Column("program_instance_id", sa.UUID(), nullable=True))

    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_templates_code ON workflow_templates (code)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_contracts_organization ON contracts (organization_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_licenses_program_instance ON licenses (program_instance_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflow_stage_instances_program_instance ON workflow_stage_instances (program_instance_id)")
    op.execute(
        """
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_workflow_stages_stage_catalog_id_workflow_stage_catalog') THEN
            ALTER TABLE workflow_stages ADD CONSTRAINT fk_workflow_stages_stage_catalog_id_workflow_stage_catalog FOREIGN KEY (stage_catalog_id) REFERENCES workflow_stage_catalog(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_contracts_organization_id_organizations') THEN
            ALTER TABLE contracts ADD CONSTRAINT fk_contracts_organization_id_organizations FOREIGN KEY (organization_id) REFERENCES organizations(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_contracts_attachment_id_files') THEN
            ALTER TABLE contracts ADD CONSTRAINT fk_contracts_attachment_id_files FOREIGN KEY (attachment_id) REFERENCES files(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_licenses_program_instance_id_program_instances') THEN
            ALTER TABLE licenses ADD CONSTRAINT fk_licenses_program_instance_id_program_instances FOREIGN KEY (program_instance_id) REFERENCES program_instances(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_licenses_attachment_id_files') THEN
            ALTER TABLE licenses ADD CONSTRAINT fk_licenses_attachment_id_files FOREIGN KEY (attachment_id) REFERENCES files(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_workflow_stage_instances_program_instance_id_program_instances') THEN
            ALTER TABLE workflow_stage_instances ADD CONSTRAINT fk_workflow_stage_instances_program_instance_id_program_instances FOREIGN KEY (program_instance_id) REFERENCES program_instances(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_workflow_transition_history_program_instance_id_program_instances') THEN
            ALTER TABLE workflow_transition_history ADD CONSTRAINT fk_workflow_transition_history_program_instance_id_program_instances FOREIGN KEY (program_instance_id) REFERENCES program_instances(id);
          END IF;
        END $$
        """
    )
    op.execute("ALTER TABLE contracts ALTER COLUMN interaction_id DROP NOT NULL")
    op.execute("ALTER TABLE licenses ALTER COLUMN contract_id DROP NOT NULL")
    op.execute("ALTER TABLE workflow_stage_instances ALTER COLUMN interaction_id DROP NOT NULL")
    op.execute("ALTER TABLE workflow_transition_history ALTER COLUMN interaction_id DROP NOT NULL")

    op.execute(
        """
        INSERT INTO organization_types (id, code, name, is_active, created_at, updated_at)
        VALUES
          (gen_random_uuid(), 'university', 'Вуз', true, now(), now()),
          (gen_random_uuid(), 'spo', 'СПО', true, now(), now()),
          (gen_random_uuid(), 'school', 'Школа', true, now(), now())
        ON CONFLICT (code) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO organizations (id, type_id, name, short_name, region, city, status, created_at, updated_at)
        SELECT u.id, t.id, u.name, u.short_name, u.region, u.city, 'active', u.created_at, u.updated_at
        FROM universities u
        CROSS JOIN organization_types t
        WHERE t.code = 'university'
        ON CONFLICT (id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO org_assignments (id, organization_id, user_id, status, assigned_at, assigned_by, created_at, updated_at)
        SELECT gen_random_uuid(), source.university_id, source.manager_user_id, 'active', now(), source.manager_user_id, now(), now()
        FROM (
          SELECT DISTINCT ON (university_id) university_id, manager_user_id
          FROM university_interactions
          WHERE manager_user_id IS NOT NULL
          ORDER BY university_id, updated_at DESC
        ) source
        WHERE NOT EXISTS (
          SELECT 1 FROM org_assignments assignment
          WHERE assignment.organization_id = source.university_id AND assignment.status = 'active'
        )
        """
    )
    op.execute(
        """
        INSERT INTO program_instances (
          id, organization_id, direction_id, product_id, kam_user_id,
          playbook_template_id, workflow_version_id, current_stage_instance_id,
          template_snapshot, status, health_band, started_at, completed_at,
          legacy_interaction_id, created_at, updated_at
        )
        SELECT i.id, i.university_id, p.direction_id, i.product_id, i.manager_user_id,
               i.workflow_template_id, i.workflow_version_id, i.current_stage_instance_id,
               jsonb_build_object('legacy_interaction_id', i.id),
               CASE
                 WHEN upper(i.status) = 'COMPLETED' THEN 'completed'
                 WHEN upper(i.status) = 'CANCELLED' THEN 'cancelled'
                 WHEN upper(i.status) = 'PAUSED' THEN 'paused'
                 WHEN upper(i.status) = 'DRAFT' THEN 'draft'
                 ELSE 'active'
               END,
               'green', i.started_at, i.completed_at, i.id, i.created_at, i.updated_at
        FROM university_interactions i
        JOIN it_programs p ON p.id = i.program_id
        WHERE i.workflow_template_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM program_instances pi WHERE pi.legacy_interaction_id = i.id)
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        "UPDATE workflow_stage_instances s SET program_instance_id = p.id FROM program_instances p WHERE p.legacy_interaction_id = s.interaction_id AND s.program_instance_id IS NULL"
    )
    op.execute(
        "UPDATE workflow_transition_history h SET program_instance_id = p.id FROM program_instances p WHERE p.legacy_interaction_id = h.interaction_id AND h.program_instance_id IS NULL"
    )


def upgrade() -> None:
    _upgrade_from_legacy()
    return
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('academic_windows',
    sa.Column('code', sa.String(length=64), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('plan_cutoff_on', sa.Date(), nullable=False),
    sa.Column('classes_start_on', sa.Date(), nullable=False),
    sa.Column('classes_end_on', sa.Date(), nullable=False),
    sa.Column('is_current', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_academic_windows')),
    sa.UniqueConstraint('code', name=op.f('uq_academic_windows_code'))
    )
    op.create_table('it_directions',
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('code', sa.String(length=64), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_it_directions'))
    )
    op.create_table('organization_types',
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('name', sa.String(length=128), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_organization_types')),
    sa.UniqueConstraint('code', name=op.f('uq_organization_types_code'))
    )
    op.create_table('roles',
    sa.Column('name', sa.String(length=64), nullable=False),
    sa.Column('description', sa.String(length=255), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_roles')),
    sa.UniqueConstraint('name', name=op.f('uq_roles_name'))
    )
    op.create_table('universities',
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('short_name', sa.String(length=255), nullable=True),
    sa.Column('region', sa.String(length=255), nullable=True),
    sa.Column('city', sa.String(length=255), nullable=True),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('website', sa.String(length=512), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_universities'))
    )
    op.create_table('users',
    sa.Column('keycloak_user_id', sa.UUID(), nullable=True),
    sa.Column('username', sa.String(length=255), nullable=True),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('role', sa.String(length=64), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    sa.UniqueConstraint('keycloak_user_id', name=op.f('uq_users_keycloak_user_id')),
    sa.UniqueConstraint('username', name=op.f('uq_users_username'))
    )
    op.create_table('vendors',
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_vendors'))
    )
    op.create_table('workflow_phases',
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('name', sa.String(length=128), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_phases')),
    sa.UniqueConstraint('code', name=op.f('uq_workflow_phases_code'))
    )
    op.create_table('audit_events',
    sa.Column('actor_user_id', sa.UUID(), nullable=True),
    sa.Column('action', sa.String(length=128), nullable=False),
    sa.Column('entity_type', sa.String(length=128), nullable=False),
    sa.Column('entity_id', sa.UUID(), nullable=True),
    sa.Column('result', sa.String(length=32), nullable=False),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('error_code', sa.String(length=128), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('request_id', sa.String(length=128), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], name=op.f('fk_audit_events_actor_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_events'))
    )
    op.create_index('ix_audit_events_action', 'audit_events', ['action'], unique=False)
    op.create_index('ix_audit_events_actor_created_at', 'audit_events', ['actor_user_id', 'created_at'], unique=False)
    op.create_index('ix_audit_events_created_at', 'audit_events', ['created_at'], unique=False)
    op.create_index('ix_audit_events_entity', 'audit_events', ['entity_type', 'entity_id'], unique=False)
    op.create_table('files',
    sa.Column('original_name', sa.String(length=255), nullable=False),
    sa.Column('storage_name', sa.String(length=255), nullable=False),
    sa.Column('storage_path', sa.String(length=1024), nullable=False),
    sa.Column('mime_type', sa.String(length=255), nullable=True),
    sa.Column('extension', sa.String(length=32), nullable=True),
    sa.Column('size_bytes', sa.BigInteger(), nullable=True),
    sa.Column('checksum', sa.String(length=255), nullable=True),
    sa.Column('provider', sa.String(length=32), nullable=True),
    sa.Column('bucket', sa.String(length=255), nullable=True),
    sa.Column('object_key', sa.String(length=1024), nullable=True),
    sa.Column('uploaded_by', sa.UUID(), nullable=True),
    sa.Column('scan_status', sa.String(length=32), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('delete_after', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by', sa.UUID(), nullable=True),
    sa.Column('purged_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], name=op.f('fk_files_deleted_by_users')),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], name=op.f('fk_files_uploaded_by_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_files')),
    sa.UniqueConstraint('provider', 'bucket', 'object_key', name='uq_files_provider_bucket_object_key')
    )
    op.create_index('ix_files_cleanup_state', 'files', ['deleted_at', 'delete_after', 'purged_at'], unique=False)
    op.create_table('import_mappings',
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('is_system', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_import_mappings_created_by_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_import_mappings')),
    sa.UniqueConstraint('name', name='uq_import_mappings_name')
    )
    op.create_table('it_products',
    sa.Column('vendor_id', sa.UUID(), nullable=True),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('documentation_url', sa.String(length=512), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], name=op.f('fk_it_products_vendor_id_vendors')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_it_products'))
    )
    op.create_table('it_programs',
    sa.Column('direction_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('version', sa.String(length=64), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['direction_id'], ['it_directions.id'], name=op.f('fk_it_programs_direction_id_it_directions')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_it_programs'))
    )
    op.create_table('manager_memberships',
    sa.Column('manager_user_id', sa.UUID(), nullable=False),
    sa.Column('kam_user_id', sa.UUID(), nullable=False),
    sa.Column('valid_from', sa.DateTime(timezone=True), nullable=True),
    sa.Column('valid_to', sa.DateTime(timezone=True), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['kam_user_id'], ['users.id'], name=op.f('fk_manager_memberships_kam_user_id_users')),
    sa.ForeignKeyConstraint(['manager_user_id'], ['users.id'], name=op.f('fk_manager_memberships_manager_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_manager_memberships')),
    sa.UniqueConstraint('manager_user_id', 'kam_user_id', name='uq_manager_memberships_manager_kam')
    )
    op.create_index('ix_manager_memberships_kam_active', 'manager_memberships', ['kam_user_id', 'is_active'], unique=False)
    op.create_index('ix_manager_memberships_manager_active', 'manager_memberships', ['manager_user_id', 'is_active'], unique=False)
    op.create_table('organizations',
    sa.Column('type_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('short_name', sa.String(length=255), nullable=True),
    sa.Column('region', sa.String(length=255), nullable=True),
    sa.Column('city', sa.String(length=255), nullable=True),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('active', 'paused', 'archived')", name=op.f('ck_organizations_organization_status')),
    sa.ForeignKeyConstraint(['type_id'], ['organization_types.id'], name=op.f('fk_organizations_type_id_organization_types')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_organizations'))
    )
    op.create_table('report_jobs',
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('format', sa.String(length=16), nullable=False),
    sa.Column('filter_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('columns_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('queued_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('row_count', sa.Integer(), nullable=False),
    sa.Column('error_code', sa.String(length=128), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('request_id', sa.String(length=128), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_report_jobs_created_by_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_report_jobs'))
    )
    op.create_index('ix_report_jobs_created_by', 'report_jobs', ['created_by'], unique=False)
    op.create_index('ix_report_jobs_status_created_at', 'report_jobs', ['status', 'created_at'], unique=False)
    op.create_table('university_contacts',
    sa.Column('university_id', sa.UUID(), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('position', sa.String(length=255), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('phone', sa.String(length=64), nullable=True),
    sa.Column('department', sa.String(length=255), nullable=True),
    sa.Column('is_primary', sa.Boolean(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['university_id'], ['universities.id'], name=op.f('fk_university_contacts_university_id_universities')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_university_contacts'))
    )
    op.create_table('user_roles',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('role_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name=op.f('fk_user_roles_role_id_roles')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_roles_user_id_users')),
    sa.PrimaryKeyConstraint('user_id', 'role_id', name=op.f('pk_user_roles'))
    )
    op.create_table('workflow_stage_catalog',
    sa.Column('code', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('default_phase_id', sa.UUID(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['default_phase_id'], ['workflow_phases.id'], name=op.f('fk_workflow_stage_catalog_default_phase_id_workflow_phases')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_stage_catalog')),
    sa.UniqueConstraint('code', name=op.f('uq_workflow_stage_catalog_code'))
    )
    op.create_table('workflow_templates',
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('version', sa.String(length=64), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('code', sa.String(length=64), nullable=True),
    sa.Column('applies_to_type', sa.String(length=32), nullable=False),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_workflow_templates_created_by_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_templates')),
    sa.UniqueConstraint('code', name=op.f('uq_workflow_templates_code'))
    )
    op.create_table('import_jobs',
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('source_file_id', sa.UUID(), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('sheet_name', sa.String(length=255), nullable=True),
    sa.Column('header_row', sa.Integer(), nullable=False),
    sa.Column('mapping_id', sa.UUID(), nullable=True),
    sa.Column('mapping_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('diff_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('total_rows', sa.Integer(), nullable=False),
    sa.Column('valid_rows', sa.Integer(), nullable=False),
    sa.Column('invalid_rows', sa.Integer(), nullable=False),
    sa.Column('create_count', sa.Integer(), nullable=False),
    sa.Column('update_count', sa.Integer(), nullable=False),
    sa.Column('skip_count', sa.Integer(), nullable=False),
    sa.Column('conflict_count', sa.Integer(), nullable=False),
    sa.Column('validated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('error_code', sa.String(length=64), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_import_jobs_created_by_users')),
    sa.ForeignKeyConstraint(['mapping_id'], ['import_mappings.id'], name=op.f('fk_import_jobs_mapping_id_import_mappings')),
    sa.ForeignKeyConstraint(['source_file_id'], ['files.id'], name=op.f('fk_import_jobs_source_file_id_files')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_import_jobs'))
    )
    op.create_index('ix_import_jobs_created_by', 'import_jobs', ['created_by'], unique=False)
    op.create_index('ix_import_jobs_status_created_at', 'import_jobs', ['status', 'created_at'], unique=False)
    op.create_table('import_mapping_fields',
    sa.Column('mapping_id', sa.UUID(), nullable=False),
    sa.Column('source_column', sa.String(length=255), nullable=False),
    sa.Column('target_field', sa.String(length=128), nullable=False),
    sa.Column('required', sa.Boolean(), nullable=False),
    sa.Column('transformer', sa.String(length=128), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['mapping_id'], ['import_mappings.id'], name=op.f('fk_import_mapping_fields_mapping_id_import_mappings'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_import_mapping_fields')),
    sa.UniqueConstraint('mapping_id', 'source_column', name='uq_import_mapping_fields_source'),
    sa.UniqueConstraint('mapping_id', 'target_field', name='uq_import_mapping_fields_target')
    )
    op.create_table('org_assignments',
    sa.Column('organization_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('assigned_by', sa.UUID(), nullable=False),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('active', 'ended')", name=op.f('ck_org_assignments_org_assignment_status')),
    sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], name=op.f('fk_org_assignments_assigned_by_users')),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_org_assignments_organization_id_organizations')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_org_assignments_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_org_assignments'))
    )
    op.create_table('program_products',
    sa.Column('program_id', sa.UUID(), nullable=False),
    sa.Column('product_id', sa.UUID(), nullable=False),
    sa.Column('is_required', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['it_products.id'], name=op.f('fk_program_products_product_id_it_products')),
    sa.ForeignKeyConstraint(['program_id'], ['it_programs.id'], name=op.f('fk_program_products_program_id_it_programs')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_program_products')),
    sa.UniqueConstraint('program_id', 'product_id', name='uq_program_products_program_product')
    )
    op.create_table('report_artifacts',
    sa.Column('report_job_id', sa.UUID(), nullable=False),
    sa.Column('file_id', sa.UUID(), nullable=False),
    sa.Column('artifact_type', sa.String(length=32), nullable=False),
    sa.Column('format', sa.String(length=16), nullable=False),
    sa.Column('row_count', sa.Integer(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['file_id'], ['files.id'], name=op.f('fk_report_artifacts_file_id_files')),
    sa.ForeignKeyConstraint(['report_job_id'], ['report_jobs.id'], name=op.f('fk_report_artifacts_report_job_id_report_jobs'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_report_artifacts'))
    )
    op.create_index('ix_report_artifacts_file', 'report_artifacts', ['file_id'], unique=False)
    op.create_index('ix_report_artifacts_job_type', 'report_artifacts', ['report_job_id', 'artifact_type'], unique=False)
    op.create_table('stakeholders',
    sa.Column('organization_id', sa.UUID(), nullable=False),
    sa.Column('role_code', sa.String(length=32), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('position', sa.String(length=255), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('phone', sa.String(length=64), nullable=True),
    sa.Column('is_primary', sa.Boolean(), nullable=False),
    sa.Column('program_instance_id', sa.UUID(), nullable=True),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("role_code IN ('vice_rector', 'dean', 'methodist', 'lawyer', 'chair', 'teacher', 'director', 'school_teacher', 'other')", name=op.f('ck_stakeholders_stakeholder_role_code')),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_stakeholders_organization_id_organizations')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_stakeholders'))
    )
    op.create_table('workflow_versions',
    sa.Column('workflow_template_id', sa.UUID(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('supersedes_version_id', sa.UUID(), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_workflow_versions_created_by_users')),
    sa.ForeignKeyConstraint(['supersedes_version_id'], ['workflow_versions.id'], name=op.f('fk_workflow_versions_supersedes_version_id_workflow_versions')),
    sa.ForeignKeyConstraint(['workflow_template_id'], ['workflow_templates.id'], name=op.f('fk_workflow_versions_workflow_template_id_workflow_templates')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_versions')),
    sa.UniqueConstraint('workflow_template_id', 'version', name='uq_workflow_versions_template_version')
    )
    op.create_index('ix_workflow_versions_template_status', 'workflow_versions', ['workflow_template_id', 'status'], unique=False)
    op.create_table('import_artifacts',
    sa.Column('import_job_id', sa.UUID(), nullable=False),
    sa.Column('file_id', sa.UUID(), nullable=False),
    sa.Column('artifact_type', sa.String(length=32), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['file_id'], ['files.id'], name=op.f('fk_import_artifacts_file_id_files')),
    sa.ForeignKeyConstraint(['import_job_id'], ['import_jobs.id'], name=op.f('fk_import_artifacts_import_job_id_import_jobs'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_import_artifacts')),
    sa.UniqueConstraint('import_job_id', 'file_id', 'artifact_type', name='uq_import_artifacts_job_file_type')
    )
    op.create_index('ix_import_artifacts_job_type', 'import_artifacts', ['import_job_id', 'artifact_type'], unique=False)
    op.create_table('import_row_errors',
    sa.Column('import_job_id', sa.UUID(), nullable=False),
    sa.Column('row_number', sa.Integer(), nullable=False),
    sa.Column('column_name', sa.String(length=255), nullable=True),
    sa.Column('target_field', sa.String(length=128), nullable=True),
    sa.Column('error_code', sa.String(length=64), nullable=False),
    sa.Column('message', sa.Text(), nullable=False),
    sa.Column('raw_fragment', sa.String(length=512), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['import_job_id'], ['import_jobs.id'], name=op.f('fk_import_row_errors_import_job_id_import_jobs'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_import_row_errors'))
    )
    op.create_index('ix_import_row_errors_job_row', 'import_row_errors', ['import_job_id', 'row_number'], unique=False)
    op.create_table('university_interactions',
    sa.Column('university_id', sa.UUID(), nullable=False),
    sa.Column('program_id', sa.UUID(), nullable=False),
    sa.Column('product_id', sa.UUID(), nullable=False),
    sa.Column('manager_user_id', sa.UUID(), nullable=True),
    sa.Column('workflow_template_id', sa.UUID(), nullable=True),
    sa.Column('workflow_version_id', sa.UUID(), nullable=True),
    sa.Column('current_stage_instance_id', sa.UUID(), nullable=True),
    sa.Column('status', sa.String(length=64), nullable=False),
    sa.Column('contract_number', sa.String(length=255), nullable=True),
    sa.Column('license_signed', sa.Boolean(), nullable=False),
    sa.Column('license_signed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('license_valid_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('transfer_status', sa.String(length=64), nullable=True),
    sa.Column('university_responsibles', sa.Text(), nullable=True),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['current_stage_instance_id'], ['workflow_stage_instances.id'], name='fk_university_interactions_current_stage_instance', use_alter=True),
    sa.ForeignKeyConstraint(['manager_user_id'], ['users.id'], name=op.f('fk_university_interactions_manager_user_id_users')),
    sa.ForeignKeyConstraint(['product_id'], ['it_products.id'], name=op.f('fk_university_interactions_product_id_it_products')),
    sa.ForeignKeyConstraint(['program_id'], ['it_programs.id'], name=op.f('fk_university_interactions_program_id_it_programs')),
    sa.ForeignKeyConstraint(['university_id'], ['universities.id'], name=op.f('fk_university_interactions_university_id_universities')),
    sa.ForeignKeyConstraint(['workflow_template_id'], ['workflow_templates.id'], name=op.f('fk_university_interactions_workflow_template_id_workflow_templates')),
    sa.ForeignKeyConstraint(['workflow_version_id'], ['workflow_versions.id'], name=op.f('fk_university_interactions_workflow_version_id_workflow_versions')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_university_interactions'))
    )
    op.create_index('ix_university_interactions_workflow_version', 'university_interactions', ['workflow_version_id'], unique=False)
    op.create_table('workflow_change_requests',
    sa.Column('workflow_version_id', sa.UUID(), nullable=False),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('requested_by', sa.UUID(), nullable=False),
    sa.Column('reviewed_by', sa.UUID(), nullable=True),
    sa.Column('requested_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('review_comment', sa.Text(), nullable=True),
    sa.Column('dangerous_changes_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['requested_by'], ['users.id'], name=op.f('fk_workflow_change_requests_requested_by_users')),
    sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], name=op.f('fk_workflow_change_requests_reviewed_by_users')),
    sa.ForeignKeyConstraint(['workflow_version_id'], ['workflow_versions.id'], name=op.f('fk_workflow_change_requests_workflow_version_id_workflow_versions')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_change_requests'))
    )
    op.create_index('ix_workflow_change_requests_version_status', 'workflow_change_requests', ['workflow_version_id', 'status'], unique=False)
    op.create_table('workflow_stages',
    sa.Column('workflow_template_id', sa.UUID(), nullable=False),
    sa.Column('workflow_version_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('order_index', sa.Integer(), nullable=False),
    sa.Column('is_initial', sa.Boolean(), nullable=False),
    sa.Column('is_final', sa.Boolean(), nullable=False),
    sa.Column('is_optional', sa.Boolean(), nullable=False),
    sa.Column('default_duration_days', sa.Integer(), nullable=True),
    sa.Column('requires_comment', sa.Boolean(), nullable=False),
    sa.Column('requires_attachment', sa.Boolean(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('stage_catalog_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['stage_catalog_id'], ['workflow_stage_catalog.id'], name=op.f('fk_workflow_stages_stage_catalog_id_workflow_stage_catalog')),
    sa.ForeignKeyConstraint(['workflow_template_id'], ['workflow_templates.id'], name=op.f('fk_workflow_stages_workflow_template_id_workflow_templates')),
    sa.ForeignKeyConstraint(['workflow_version_id'], ['workflow_versions.id'], name=op.f('fk_workflow_stages_workflow_version_id_workflow_versions')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_stages'))
    )
    op.create_index('ix_workflow_stages_version_order', 'workflow_stages', ['workflow_version_id', 'order_index'], unique=False)
    op.create_table('contracts',
    sa.Column('interaction_id', sa.UUID(), nullable=False),
    sa.Column('number', sa.String(length=255), nullable=False),
    sa.Column('signed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('valid_from', sa.DateTime(timezone=True), nullable=True),
    sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('status', sa.String(length=64), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['interaction_id'], ['university_interactions.id'], name=op.f('fk_contracts_interaction_id_university_interactions'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_contracts')),
    sa.UniqueConstraint('interaction_id', 'number', name='uq_contracts_interaction_number')
    )
    op.create_index('ix_contracts_interaction', 'contracts', ['interaction_id'], unique=False)
    op.create_table('data_access_scopes',
    sa.Column('subject_user_id', sa.UUID(), nullable=False),
    sa.Column('university_id', sa.UUID(), nullable=True),
    sa.Column('interaction_id', sa.UUID(), nullable=True),
    sa.Column('access_level', sa.String(length=64), nullable=False),
    sa.Column('granted_by_user_id', sa.UUID(), nullable=True),
    sa.Column('valid_from', sa.DateTime(timezone=True), nullable=True),
    sa.Column('valid_to', sa.DateTime(timezone=True), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['granted_by_user_id'], ['users.id'], name=op.f('fk_data_access_scopes_granted_by_user_id_users')),
    sa.ForeignKeyConstraint(['interaction_id'], ['university_interactions.id'], name=op.f('fk_data_access_scopes_interaction_id_university_interactions')),
    sa.ForeignKeyConstraint(['subject_user_id'], ['users.id'], name=op.f('fk_data_access_scopes_subject_user_id_users')),
    sa.ForeignKeyConstraint(['university_id'], ['universities.id'], name=op.f('fk_data_access_scopes_university_id_universities')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_data_access_scopes'))
    )
    op.create_index('ix_data_access_scopes_interaction', 'data_access_scopes', ['interaction_id'], unique=False)
    op.create_index('ix_data_access_scopes_subject_active', 'data_access_scopes', ['subject_user_id', 'is_active'], unique=False)
    op.create_index('ix_data_access_scopes_university', 'data_access_scopes', ['university_id'], unique=False)
    op.create_table('interaction_contacts',
    sa.Column('interaction_id', sa.UUID(), nullable=False),
    sa.Column('contact_id', sa.UUID(), nullable=False),
    sa.Column('role', sa.String(length=255), nullable=True),
    sa.Column('is_primary', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['contact_id'], ['university_contacts.id'], name=op.f('fk_interaction_contacts_contact_id_university_contacts')),
    sa.ForeignKeyConstraint(['interaction_id'], ['university_interactions.id'], name=op.f('fk_interaction_contacts_interaction_id_university_interactions')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_interaction_contacts')),
    sa.UniqueConstraint('interaction_id', 'contact_id', name='uq_interaction_contacts_interaction_contact')
    )
    op.create_table('playbook_checklist_items',
    sa.Column('workflow_stage_id', sa.UUID(), nullable=False),
    sa.Column('code', sa.String(length=64), nullable=False),
    sa.Column('label', sa.String(length=255), nullable=False),
    sa.Column('item_type', sa.String(length=32), nullable=False),
    sa.Column('required', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("item_type IN ('checkbox','file','date','stakeholder_role','number','text')", name=op.f('ck_playbook_checklist_items_checklist_item_type')),
    sa.ForeignKeyConstraint(['workflow_stage_id'], ['workflow_stages.id'], name=op.f('fk_playbook_checklist_items_workflow_stage_id_workflow_stages')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_playbook_checklist_items'))
    )
    op.create_table('program_instances',
    sa.Column('organization_id', sa.UUID(), nullable=False),
    sa.Column('direction_id', sa.UUID(), nullable=False),
    sa.Column('product_id', sa.UUID(), nullable=False),
    sa.Column('kam_user_id', sa.UUID(), nullable=True),
    sa.Column('playbook_template_id', sa.UUID(), nullable=False),
    sa.Column('template_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('current_stage_code', sa.String(length=64), nullable=True),
    sa.Column('academic_window_id', sa.UUID(), nullable=True),
    sa.Column('health_score', sa.Integer(), nullable=True),
    sa.Column('health_band', sa.String(length=16), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('parent_program_id', sa.UUID(), nullable=True),
    sa.Column('legacy_interaction_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("health_band IN ('green', 'yellow', 'red')", name=op.f('ck_program_instances_program_instance_health_band')),
    sa.CheckConstraint("status IN ('draft', 'active', 'paused', 'completed', 'cancelled')", name=op.f('ck_program_instances_program_instance_status')),
    sa.ForeignKeyConstraint(['academic_window_id'], ['academic_windows.id'], name=op.f('fk_program_instances_academic_window_id_academic_windows')),
    sa.ForeignKeyConstraint(['direction_id'], ['it_directions.id'], name=op.f('fk_program_instances_direction_id_it_directions')),
    sa.ForeignKeyConstraint(['kam_user_id'], ['users.id'], name=op.f('fk_program_instances_kam_user_id_users')),
    sa.ForeignKeyConstraint(['legacy_interaction_id'], ['university_interactions.id'], name=op.f('fk_program_instances_legacy_interaction_id_university_interactions')),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_program_instances_organization_id_organizations')),
    sa.ForeignKeyConstraint(['parent_program_id'], ['program_instances.id'], name=op.f('fk_program_instances_parent_program_id_program_instances')),
    sa.ForeignKeyConstraint(['playbook_template_id'], ['workflow_templates.id'], name=op.f('fk_program_instances_playbook_template_id_workflow_templates')),
    sa.ForeignKeyConstraint(['product_id'], ['it_products.id'], name=op.f('fk_program_instances_product_id_it_products')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_program_instances')),
    sa.UniqueConstraint('legacy_interaction_id', name=op.f('uq_program_instances_legacy_interaction_id'))
    )
    op.create_table('responsible_assignment_history',
    sa.Column('interaction_id', sa.UUID(), nullable=False),
    sa.Column('old_manager_user_id', sa.UUID(), nullable=True),
    sa.Column('new_manager_user_id', sa.UUID(), nullable=True),
    sa.Column('changed_by_user_id', sa.UUID(), nullable=False),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['changed_by_user_id'], ['users.id'], name=op.f('fk_responsible_assignment_history_changed_by_user_id_users')),
    sa.ForeignKeyConstraint(['interaction_id'], ['university_interactions.id'], name=op.f('fk_responsible_assignment_history_interaction_id_university_interactions')),
    sa.ForeignKeyConstraint(['new_manager_user_id'], ['users.id'], name=op.f('fk_responsible_assignment_history_new_manager_user_id_users')),
    sa.ForeignKeyConstraint(['old_manager_user_id'], ['users.id'], name=op.f('fk_responsible_assignment_history_old_manager_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_responsible_assignment_history'))
    )
    op.create_index('ix_responsible_assignment_history_interaction_changed_at', 'responsible_assignment_history', ['interaction_id', 'changed_at'], unique=False)
    op.create_table('workflow_migration_jobs',
    sa.Column('source_version_id', sa.UUID(), nullable=False),
    sa.Column('target_version_id', sa.UUID(), nullable=False),
    sa.Column('change_request_id', sa.UUID(), nullable=True),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('affected_interaction_count', sa.Integer(), nullable=False),
    sa.Column('migrated_interaction_count', sa.Integer(), nullable=False),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['change_request_id'], ['workflow_change_requests.id'], name=op.f('fk_workflow_migration_jobs_change_request_id_workflow_change_requests')),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_workflow_migration_jobs_created_by_users')),
    sa.ForeignKeyConstraint(['source_version_id'], ['workflow_versions.id'], name=op.f('fk_workflow_migration_jobs_source_version_id_workflow_versions')),
    sa.ForeignKeyConstraint(['target_version_id'], ['workflow_versions.id'], name=op.f('fk_workflow_migration_jobs_target_version_id_workflow_versions')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_migration_jobs'))
    )
    op.create_index('ix_workflow_migration_jobs_versions', 'workflow_migration_jobs', ['source_version_id', 'target_version_id'], unique=False)
    op.create_table('workflow_stage_instances',
    sa.Column('interaction_id', sa.UUID(), nullable=False),
    sa.Column('workflow_stage_id', sa.UUID(), nullable=False),
    sa.Column('responsible_user_id', sa.UUID(), nullable=True),
    sa.Column('status', sa.String(length=64), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('due_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('skipped_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['interaction_id'], ['university_interactions.id'], name=op.f('fk_workflow_stage_instances_interaction_id_university_interactions')),
    sa.ForeignKeyConstraint(['responsible_user_id'], ['users.id'], name=op.f('fk_workflow_stage_instances_responsible_user_id_users')),
    sa.ForeignKeyConstraint(['workflow_stage_id'], ['workflow_stages.id'], name=op.f('fk_workflow_stage_instances_workflow_stage_id_workflow_stages')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_stage_instances'))
    )
    op.create_table('workflow_stage_mappings',
    sa.Column('source_version_id', sa.UUID(), nullable=False),
    sa.Column('target_version_id', sa.UUID(), nullable=False),
    sa.Column('source_stage_id', sa.UUID(), nullable=False),
    sa.Column('target_stage_id', sa.UUID(), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_workflow_stage_mappings_created_by_users')),
    sa.ForeignKeyConstraint(['source_stage_id'], ['workflow_stages.id'], name=op.f('fk_workflow_stage_mappings_source_stage_id_workflow_stages')),
    sa.ForeignKeyConstraint(['source_version_id'], ['workflow_versions.id'], name=op.f('fk_workflow_stage_mappings_source_version_id_workflow_versions')),
    sa.ForeignKeyConstraint(['target_stage_id'], ['workflow_stages.id'], name=op.f('fk_workflow_stage_mappings_target_stage_id_workflow_stages')),
    sa.ForeignKeyConstraint(['target_version_id'], ['workflow_versions.id'], name=op.f('fk_workflow_stage_mappings_target_version_id_workflow_versions')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_stage_mappings')),
    sa.UniqueConstraint('source_version_id', 'target_version_id', 'source_stage_id', name='uq_workflow_stage_mappings_source_target_stage')
    )
    op.create_index('ix_workflow_stage_mappings_versions', 'workflow_stage_mappings', ['source_version_id', 'target_version_id'], unique=False)
    op.create_table('workflow_transitions',
    sa.Column('workflow_template_id', sa.UUID(), nullable=False),
    sa.Column('workflow_version_id', sa.UUID(), nullable=False),
    sa.Column('from_stage_id', sa.UUID(), nullable=False),
    sa.Column('to_stage_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=True),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('condition_code', sa.String(length=255), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['from_stage_id'], ['workflow_stages.id'], name=op.f('fk_workflow_transitions_from_stage_id_workflow_stages')),
    sa.ForeignKeyConstraint(['to_stage_id'], ['workflow_stages.id'], name=op.f('fk_workflow_transitions_to_stage_id_workflow_stages')),
    sa.ForeignKeyConstraint(['workflow_template_id'], ['workflow_templates.id'], name=op.f('fk_workflow_transitions_workflow_template_id_workflow_templates')),
    sa.ForeignKeyConstraint(['workflow_version_id'], ['workflow_versions.id'], name=op.f('fk_workflow_transitions_workflow_version_id_workflow_versions')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_transitions'))
    )
    op.create_index('ix_workflow_transitions_version_from', 'workflow_transitions', ['workflow_version_id', 'from_stage_id'], unique=False)
    op.create_table('licenses',
    sa.Column('contract_id', sa.UUID(), nullable=False),
    sa.Column('product_id', sa.UUID(), nullable=False),
    sa.Column('license_number', sa.String(length=255), nullable=True),
    sa.Column('signed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('transfer_status', sa.String(length=64), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], name=op.f('fk_licenses_contract_id_contracts'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['product_id'], ['it_products.id'], name=op.f('fk_licenses_product_id_it_products')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_licenses')),
    sa.UniqueConstraint('contract_id', 'product_id', name='uq_licenses_contract_product')
    )
    op.create_index('ix_licenses_contract', 'licenses', ['contract_id'], unique=False)
    op.create_index('ix_licenses_product', 'licenses', ['product_id'], unique=False)
    op.create_table('program_checklist_values',
    sa.Column('checklist_item_id', sa.UUID(), nullable=False),
    sa.Column('stage_instance_id', sa.UUID(), nullable=False),
    sa.Column('is_done', sa.Boolean(), nullable=False),
    sa.Column('value_text', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['checklist_item_id'], ['playbook_checklist_items.id'], name=op.f('fk_program_checklist_values_checklist_item_id_playbook_checklist_items')),
    sa.ForeignKeyConstraint(['stage_instance_id'], ['workflow_stage_instances.id'], name=op.f('fk_program_checklist_values_stage_instance_id_workflow_stage_instances')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_program_checklist_values'))
    )
    op.create_table('workflow_stage_attachments',
    sa.Column('stage_instance_id', sa.UUID(), nullable=False),
    sa.Column('file_id', sa.UUID(), nullable=False),
    sa.Column('uploaded_by', sa.UUID(), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['file_id'], ['files.id'], name=op.f('fk_workflow_stage_attachments_file_id_files')),
    sa.ForeignKeyConstraint(['stage_instance_id'], ['workflow_stage_instances.id'], name=op.f('fk_workflow_stage_attachments_stage_instance_id_workflow_stage_instances')),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], name=op.f('fk_workflow_stage_attachments_uploaded_by_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_stage_attachments'))
    )
    op.create_table('workflow_stage_comments',
    sa.Column('stage_instance_id', sa.UUID(), nullable=False),
    sa.Column('author_user_id', sa.UUID(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], name=op.f('fk_workflow_stage_comments_author_user_id_users')),
    sa.ForeignKeyConstraint(['stage_instance_id'], ['workflow_stage_instances.id'], name=op.f('fk_workflow_stage_comments_stage_instance_id_workflow_stage_instances')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_stage_comments'))
    )
    op.create_table('workflow_transition_history',
    sa.Column('interaction_id', sa.UUID(), nullable=False),
    sa.Column('from_stage_instance_id', sa.UUID(), nullable=True),
    sa.Column('to_stage_instance_id', sa.UUID(), nullable=True),
    sa.Column('transition_id', sa.UUID(), nullable=True),
    sa.Column('performed_by', sa.UUID(), nullable=False),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('performed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['from_stage_instance_id'], ['workflow_stage_instances.id'], name=op.f('fk_workflow_transition_history_from_stage_instance_id_workflow_stage_instances')),
    sa.ForeignKeyConstraint(['interaction_id'], ['university_interactions.id'], name=op.f('fk_workflow_transition_history_interaction_id_university_interactions')),
    sa.ForeignKeyConstraint(['performed_by'], ['users.id'], name=op.f('fk_workflow_transition_history_performed_by_users')),
    sa.ForeignKeyConstraint(['to_stage_instance_id'], ['workflow_stage_instances.id'], name=op.f('fk_workflow_transition_history_to_stage_instance_id_workflow_stage_instances')),
    sa.ForeignKeyConstraint(['transition_id'], ['workflow_transitions.id'], name=op.f('fk_workflow_transition_history_transition_id_workflow_transitions')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_transition_history'))
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("universities"):
        op.drop_constraint(
            "fk_workflow_stages_stage_catalog_id_workflow_stage_catalog",
            "workflow_stages",
            type_="foreignkey",
        )
        op.drop_column("workflow_stages", "stage_catalog_id")
        op.drop_index("uq_workflow_templates_code", table_name="workflow_templates")
        op.drop_column("workflow_templates", "status")
        op.drop_column("workflow_templates", "applies_to_type")
        op.drop_column("workflow_templates", "code")
        op.drop_table("program_checklist_values")
        op.drop_table("playbook_checklist_items")
        op.drop_table("stakeholders")
        op.drop_table("org_assignments")
        op.drop_table("program_instances")
        op.drop_table("workflow_stage_catalog")
        op.drop_table("organizations")
        op.drop_table("workflow_phases")
        op.drop_table("organization_types")
        op.drop_table("academic_windows")
        return
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('workflow_transition_history')
    op.drop_table('workflow_stage_comments')
    op.drop_table('workflow_stage_attachments')
    op.drop_table('program_checklist_values')
    op.drop_index('ix_licenses_product', table_name='licenses')
    op.drop_index('ix_licenses_contract', table_name='licenses')
    op.drop_table('licenses')
    op.drop_index('ix_workflow_transitions_version_from', table_name='workflow_transitions')
    op.drop_table('workflow_transitions')
    op.drop_index('ix_workflow_stage_mappings_versions', table_name='workflow_stage_mappings')
    op.drop_table('workflow_stage_mappings')
    op.drop_table('workflow_stage_instances')
    op.drop_index('ix_workflow_migration_jobs_versions', table_name='workflow_migration_jobs')
    op.drop_table('workflow_migration_jobs')
    op.drop_index('ix_responsible_assignment_history_interaction_changed_at', table_name='responsible_assignment_history')
    op.drop_table('responsible_assignment_history')
    op.drop_table('program_instances')
    op.drop_table('playbook_checklist_items')
    op.drop_table('interaction_contacts')
    op.drop_index('ix_data_access_scopes_university', table_name='data_access_scopes')
    op.drop_index('ix_data_access_scopes_subject_active', table_name='data_access_scopes')
    op.drop_index('ix_data_access_scopes_interaction', table_name='data_access_scopes')
    op.drop_table('data_access_scopes')
    op.drop_index('ix_contracts_interaction', table_name='contracts')
    op.drop_table('contracts')
    op.drop_index('ix_workflow_stages_version_order', table_name='workflow_stages')
    op.drop_table('workflow_stages')
    op.drop_index('ix_workflow_change_requests_version_status', table_name='workflow_change_requests')
    op.drop_table('workflow_change_requests')
    op.drop_index('ix_university_interactions_workflow_version', table_name='university_interactions')
    op.drop_table('university_interactions')
    op.drop_index('ix_import_row_errors_job_row', table_name='import_row_errors')
    op.drop_table('import_row_errors')
    op.drop_index('ix_import_artifacts_job_type', table_name='import_artifacts')
    op.drop_table('import_artifacts')
    op.drop_index('ix_workflow_versions_template_status', table_name='workflow_versions')
    op.drop_table('workflow_versions')
    op.drop_table('stakeholders')
    op.drop_index('ix_report_artifacts_job_type', table_name='report_artifacts')
    op.drop_index('ix_report_artifacts_file', table_name='report_artifacts')
    op.drop_table('report_artifacts')
    op.drop_table('program_products')
    op.drop_table('org_assignments')
    op.drop_table('import_mapping_fields')
    op.drop_index('ix_import_jobs_status_created_at', table_name='import_jobs')
    op.drop_index('ix_import_jobs_created_by', table_name='import_jobs')
    op.drop_table('import_jobs')
    op.drop_table('workflow_templates')
    op.drop_table('workflow_stage_catalog')
    op.drop_table('user_roles')
    op.drop_table('university_contacts')
    op.drop_index('ix_report_jobs_status_created_at', table_name='report_jobs')
    op.drop_index('ix_report_jobs_created_by', table_name='report_jobs')
    op.drop_table('report_jobs')
    op.drop_table('organizations')
    op.drop_index('ix_manager_memberships_manager_active', table_name='manager_memberships')
    op.drop_index('ix_manager_memberships_kam_active', table_name='manager_memberships')
    op.drop_table('manager_memberships')
    op.drop_table('it_programs')
    op.drop_table('it_products')
    op.drop_table('import_mappings')
    op.drop_index('ix_files_cleanup_state', table_name='files')
    op.drop_table('files')
    op.drop_index('ix_audit_events_entity', table_name='audit_events')
    op.drop_index('ix_audit_events_created_at', table_name='audit_events')
    op.drop_index('ix_audit_events_actor_created_at', table_name='audit_events')
    op.drop_index('ix_audit_events_action', table_name='audit_events')
    op.drop_table('audit_events')
    op.drop_table('workflow_phases')
    op.drop_table('vendors')
    op.drop_table('users')
    op.drop_table('universities')
    op.drop_table('roles')
    op.drop_table('organization_types')
    op.drop_table('it_directions')
    op.drop_table('academic_windows')
    # ### end Alembic commands ###

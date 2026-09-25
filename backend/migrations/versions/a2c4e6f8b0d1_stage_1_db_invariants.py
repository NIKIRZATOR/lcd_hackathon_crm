"""Stage 1 database invariants and access-path indexes.

Revision ID: a2c4e6f8b0d1
Revises: 9b6f3a1e7d50
"""

from collections.abc import Sequence

from alembic import op


revision: str = "a2c4e6f8b0d1"
down_revision: str | None = "9b6f3a1e7d50"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Preserve assignment history while making the most recent assignment canonical.
    op.execute(
        """
        WITH ranked AS (
          SELECT id,
                 row_number() OVER (
                   PARTITION BY organization_id
                   ORDER BY assigned_at DESC, created_at DESC, id DESC
                 ) AS position
          FROM org_assignments
          WHERE status = 'active'
        )
        UPDATE org_assignments assignment
        SET status = 'ended', ended_at = COALESCE(ended_at, now()), updated_at = now()
        FROM ranked
        WHERE assignment.id = ranked.id AND ranked.position > 1
        """
    )

    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_program_instances_active_scope "
        "ON program_instances (organization_id, direction_id, product_id) "
        "WHERE status IN ('draft', 'active', 'paused')"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_program_instances_kam_status_health "
        "ON program_instances (kam_user_id, status, health_band)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_org_assignments_active_organization "
        "ON org_assignments (organization_id) WHERE status = 'active'"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_org_assignments_user_status "
        "ON org_assignments (user_id, status)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_program_checklist_values_stage_item "
        "ON program_checklist_values (stage_instance_id, checklist_item_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_workflow_stage_instances_status_due "
        "ON workflow_stage_instances (status, due_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_integration_signals_source_status_created "
        "ON integration_signals (source, status, created_at)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_organization_number "
        "ON contracts (organization_id, number) WHERE organization_id IS NOT NULL"
    )

    op.execute(
        """
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_program_instances_program_instance_health_score') THEN
            ALTER TABLE program_instances ADD CONSTRAINT ck_program_instances_program_instance_health_score
              CHECK (health_score IS NULL OR (health_score >= 0 AND health_score <= 100));
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_stakeholders_program_instance_id_program_instances') THEN
            ALTER TABLE stakeholders ADD CONSTRAINT fk_stakeholders_program_instance_id_program_instances
              FOREIGN KEY (program_instance_id) REFERENCES program_instances(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_contracts_contract_owner_required') THEN
            ALTER TABLE contracts ADD CONSTRAINT ck_contracts_contract_owner_required
              CHECK (organization_id IS NOT NULL OR interaction_id IS NOT NULL);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_licenses_license_owner_required') THEN
            ALTER TABLE licenses ADD CONSTRAINT ck_licenses_license_owner_required
              CHECK (program_instance_id IS NOT NULL OR contract_id IS NOT NULL);
          END IF;
        END $$
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE licenses DROP CONSTRAINT IF EXISTS ck_licenses_license_owner_required")
    op.execute("ALTER TABLE contracts DROP CONSTRAINT IF EXISTS ck_contracts_contract_owner_required")
    op.execute("ALTER TABLE stakeholders DROP CONSTRAINT IF EXISTS fk_stakeholders_program_instance_id_program_instances")
    op.execute("ALTER TABLE program_instances DROP CONSTRAINT IF EXISTS ck_program_instances_program_instance_health_score")
    op.execute("DROP INDEX IF EXISTS uq_contracts_organization_number")
    op.execute("DROP INDEX IF EXISTS ix_integration_signals_source_status_created")
    op.execute("DROP INDEX IF EXISTS ix_workflow_stage_instances_status_due")
    op.execute("DROP INDEX IF EXISTS uq_program_checklist_values_stage_item")
    op.execute("DROP INDEX IF EXISTS ix_org_assignments_user_status")
    op.execute("DROP INDEX IF EXISTS uq_org_assignments_active_organization")
    op.execute("DROP INDEX IF EXISTS ix_program_instances_kam_status_health")
    op.execute("DROP INDEX IF EXISTS uq_program_instances_active_scope")

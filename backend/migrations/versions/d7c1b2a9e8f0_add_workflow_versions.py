"""add workflow versions

Revision ID: d7c1b2a9e8f0
Revises: c3f8a4d2b7e1
Create Date: 2026-09-21 00:00:00.000000

"""
from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "d7c1b2a9e8f0"
down_revision: str | None = "c3f8a4d2b7e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workflow_versions",
        sa.Column("workflow_template_id", sa.UUID(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("supersedes_version_id", sa.UUID(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_workflow_versions_created_by_users")),
        sa.ForeignKeyConstraint(
            ["supersedes_version_id"],
            ["workflow_versions.id"],
            name=op.f("fk_workflow_versions_supersedes_version_id_workflow_versions"),
        ),
        sa.ForeignKeyConstraint(
            ["workflow_template_id"],
            ["workflow_templates.id"],
            name=op.f("fk_workflow_versions_workflow_template_id_workflow_templates"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workflow_versions")),
        sa.UniqueConstraint("workflow_template_id", "version", name="uq_workflow_versions_template_version"),
    )

    op.add_column("workflow_stages", sa.Column("workflow_version_id", sa.UUID(), nullable=True))
    op.add_column("workflow_transitions", sa.Column("workflow_version_id", sa.UUID(), nullable=True))
    op.add_column("university_interactions", sa.Column("workflow_version_id", sa.UUID(), nullable=True))

    op.create_foreign_key(
        op.f("fk_workflow_stages_workflow_version_id_workflow_versions"),
        "workflow_stages",
        "workflow_versions",
        ["workflow_version_id"],
        ["id"],
    )
    op.create_foreign_key(
        op.f("fk_workflow_transitions_workflow_version_id_workflow_versions"),
        "workflow_transitions",
        "workflow_versions",
        ["workflow_version_id"],
        ["id"],
    )
    op.create_foreign_key(
        op.f("fk_university_interactions_workflow_version_id_workflow_versions"),
        "university_interactions",
        "workflow_versions",
        ["workflow_version_id"],
        ["id"],
    )

    bind = op.get_bind()
    template_rows = bind.execute(sa.text("select id, created_by from workflow_templates")).mappings().all()
    now = datetime.now(timezone.utc)
    version_by_template: dict[str, str] = {}
    for template in template_rows:
        version_id = str(uuid4())
        template_id = str(template["id"])
        version_by_template[template_id] = version_id
        bind.execute(
            sa.text(
                """
                insert into workflow_versions (
                    id, workflow_template_id, version, status, created_by, published_at, created_at, updated_at
                )
                values (:id, :workflow_template_id, 1, 'PUBLISHED', :created_by, :published_at, now(), now())
                """
            ),
            {
                "id": version_id,
                "workflow_template_id": template_id,
                "created_by": template["created_by"],
                "published_at": now,
            },
        )

    for template_id, version_id in version_by_template.items():
        bind.execute(
            sa.text(
                """
                update workflow_stages
                set workflow_version_id = :version_id
                where workflow_template_id = :template_id
                """
            ),
            {"version_id": version_id, "template_id": template_id},
        )
        bind.execute(
            sa.text(
                """
                update workflow_transitions
                set workflow_version_id = :version_id
                where workflow_template_id = :template_id
                """
            ),
            {"version_id": version_id, "template_id": template_id},
        )
        bind.execute(
            sa.text(
                """
                update university_interactions
                set workflow_version_id = :version_id
                where workflow_template_id = :template_id
                """
            ),
            {"version_id": version_id, "template_id": template_id},
        )

    op.alter_column("workflow_stages", "workflow_version_id", existing_type=sa.UUID(), nullable=False)
    op.alter_column("workflow_transitions", "workflow_version_id", existing_type=sa.UUID(), nullable=False)

    op.create_index("ix_workflow_versions_template_status", "workflow_versions", ["workflow_template_id", "status"])
    op.create_index("ix_workflow_stages_version_order", "workflow_stages", ["workflow_version_id", "order_index"])
    op.create_index("ix_workflow_transitions_version_from", "workflow_transitions", ["workflow_version_id", "from_stage_id"])
    op.create_index("ix_university_interactions_workflow_version", "university_interactions", ["workflow_version_id"])


def downgrade() -> None:
    op.drop_index("ix_university_interactions_workflow_version", table_name="university_interactions")
    op.drop_index("ix_workflow_transitions_version_from", table_name="workflow_transitions")
    op.drop_index("ix_workflow_stages_version_order", table_name="workflow_stages")
    op.drop_index("ix_workflow_versions_template_status", table_name="workflow_versions")

    op.drop_constraint(
        op.f("fk_university_interactions_workflow_version_id_workflow_versions"),
        "university_interactions",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_workflow_transitions_workflow_version_id_workflow_versions"),
        "workflow_transitions",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_workflow_stages_workflow_version_id_workflow_versions"),
        "workflow_stages",
        type_="foreignkey",
    )
    op.drop_column("university_interactions", "workflow_version_id")
    op.drop_column("workflow_transitions", "workflow_version_id")
    op.drop_column("workflow_stages", "workflow_version_id")
    op.drop_table("workflow_versions")

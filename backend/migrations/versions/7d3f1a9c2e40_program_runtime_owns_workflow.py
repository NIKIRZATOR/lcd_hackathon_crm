"""make program instances own workflow runtime"""
from alembic import op
import sqlalchemy as sa

revision = "7d3f1a9c2e40"
down_revision = "6c1e8a4d9b20"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("program_instances", sa.Column("workflow_version_id", sa.UUID(), nullable=True))
    op.add_column("program_instances", sa.Column("current_stage_instance_id", sa.UUID(), nullable=True))
    op.create_foreign_key(op.f("fk_program_instances_workflow_version_id_workflow_versions"), "program_instances", "workflow_versions", ["workflow_version_id"], ["id"])
    op.create_foreign_key(op.f("fk_program_instances_current_stage_instance_id_workflow_stage_instances"), "program_instances", "workflow_stage_instances", ["current_stage_instance_id"], ["id"])
    op.alter_column("workflow_stage_instances", "interaction_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("workflow_stage_instances", sa.Column("program_instance_id", sa.UUID(), nullable=True))
    op.create_foreign_key(op.f("fk_workflow_stage_instances_program_instance_id_program_instances"), "workflow_stage_instances", "program_instances", ["program_instance_id"], ["id"])
    op.create_index("ix_workflow_stage_instances_program_instance", "workflow_stage_instances", ["program_instance_id"])
    op.alter_column("workflow_transition_history", "interaction_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("workflow_transition_history", sa.Column("program_instance_id", sa.UUID(), nullable=True))
    op.create_foreign_key(op.f("fk_workflow_transition_history_program_instance_id_program_instances"), "workflow_transition_history", "program_instances", ["program_instance_id"], ["id"])
    op.execute("UPDATE workflow_stage_instances s SET program_instance_id = p.id FROM program_instances p WHERE p.legacy_interaction_id = s.interaction_id")
    op.execute("UPDATE workflow_transition_history h SET program_instance_id = p.id FROM program_instances p WHERE p.legacy_interaction_id = h.interaction_id")
    op.execute("UPDATE program_instances p SET workflow_version_id = i.workflow_version_id, current_stage_instance_id = i.current_stage_instance_id FROM university_interactions i WHERE p.legacy_interaction_id = i.id")

def downgrade():
    op.drop_constraint(op.f("fk_workflow_transition_history_program_instance_id_program_instances"), "workflow_transition_history", type_="foreignkey")
    op.drop_column("workflow_transition_history", "program_instance_id")
    op.alter_column("workflow_transition_history", "interaction_id", existing_type=sa.UUID(), nullable=False)
    op.drop_index("ix_workflow_stage_instances_program_instance", table_name="workflow_stage_instances")
    op.drop_constraint(op.f("fk_workflow_stage_instances_program_instance_id_program_instances"), "workflow_stage_instances", type_="foreignkey")
    op.drop_column("workflow_stage_instances", "program_instance_id")
    op.alter_column("workflow_stage_instances", "interaction_id", existing_type=sa.UUID(), nullable=False)
    op.drop_constraint(op.f("fk_program_instances_current_stage_instance_id_workflow_stage_instances"), "program_instances", type_="foreignkey")
    op.drop_constraint(op.f("fk_program_instances_workflow_version_id_workflow_versions"), "program_instances", type_="foreignkey")
    op.drop_column("program_instances", "current_stage_instance_id")
    op.drop_column("program_instances", "workflow_version_id")

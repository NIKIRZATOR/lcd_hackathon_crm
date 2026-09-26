"""add documentation pages and requests

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
"""
from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a5b6c7d8e9f0"
down_revision: str | None = "f4a5b6c7d8e9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "documentation_pages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("route_pattern", sa.String(255), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documentation_pages.id"), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content_markdown", sa.Text(), nullable=False, server_default=""),
        sa.Column("source_file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("files.id"), nullable=True),
        sa.UniqueConstraint("slug", name="uq_documentation_pages_slug"),
    )
    op.create_index("ix_documentation_pages_route", "documentation_pages", ["route_pattern"])
    root_id, home_id, organizations_id, workflows_id, programs_id, management_id = uuid4(), uuid4(), uuid4(), uuid4(), uuid4(), uuid4()
    pages = sa.table("documentation_pages", sa.column("id", postgresql.UUID(as_uuid=True)), sa.column("slug", sa.String), sa.column("title", sa.String), sa.column("route_pattern", sa.String), sa.column("parent_id", postgresql.UUID(as_uuid=True)), sa.column("sort_order", sa.Integer), sa.column("content_markdown", sa.Text))
    op.bulk_insert(pages, [
        {"id": root_id, "slug": "v2", "title": "RTK EduFlow CRM", "route_pattern": "/v2", "parent_id": None, "sort_order": 0, "content_markdown": "# RTK EduFlow CRM\n\nВыберите раздел в дереве слева. Здесь собраны инструкции по работе с V2."},
        {"id": home_id, "slug": "home", "title": "Главная и NBA", "route_pattern": "/v2", "parent_id": root_id, "sort_order": 10, "content_markdown": "# Главная\n\nНа главной отображается очередь действий NBA. Откройте карточку действия, чтобы перейти к нужной программе."},
        {"id": organizations_id, "slug": "organizations", "title": "Организации", "route_pattern": "/v2/organizations", "parent_id": root_id, "sort_order": 20, "content_markdown": "# Организации\n\nКарточка организации объединяет программы, людей, документы и историю событий. Новая программа создаётся из карточки организации."},
        {"id": workflows_id, "slug": "workflows", "title": "Воркфлоу и программы", "route_pattern": "/v2/workflows", "parent_id": root_id, "sort_order": 30, "content_markdown": "# Воркфлоу\n\nЗакрыть этап можно только после заполнения обязательных фактов. Сигналы LMS не закрывают этап автоматически."},
        {"id": programs_id, "slug": "program-detail", "title": "Карточка программы", "route_pattern": "/v2/programs", "parent_id": root_id, "sort_order": 40, "content_markdown": "# Карточка программы\n\nЗдесь ведутся этапы, факты, вложения, метрики и история переходов программы."},
        {"id": management_id, "slug": "management", "title": "Управление", "route_pattern": "/v2/management", "parent_id": root_id, "sort_order": 50, "content_markdown": "# Управление\n\nАдминистратор и руководитель управляют эталонами воркфлоу. Изменения публикуются только в новой версии и не меняют уже созданные программы."},
    ])
    op.create_table(
        "documentation_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("page_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documentation_pages.id"), nullable=True),
        sa.Column("author_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="open"),
    )
    op.create_index("ix_documentation_requests_status_created", "documentation_requests", ["status", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_documentation_requests_status_created", table_name="documentation_requests")
    op.drop_table("documentation_requests")
    op.drop_index("ix_documentation_pages_route", table_name="documentation_pages")
    op.drop_table("documentation_pages")

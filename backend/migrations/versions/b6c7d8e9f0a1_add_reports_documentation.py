"""add reports documentation page

Revision ID: b6c7d8e9f0a1
Revises: a5b6c7d8e9f0
"""
from collections.abc import Sequence
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b6c7d8e9f0a1"
down_revision: str | None = "a5b6c7d8e9f0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    root_id = op.get_bind().execute(sa.text("SELECT id FROM documentation_pages WHERE slug = 'v2'")).scalar_one()
    pages = sa.table("documentation_pages", sa.column("id", postgresql.UUID(as_uuid=True)), sa.column("slug", sa.String), sa.column("title", sa.String), sa.column("route_pattern", sa.String), sa.column("parent_id", postgresql.UUID(as_uuid=True)), sa.column("sort_order", sa.Integer), sa.column("content_markdown", sa.Text))
    op.bulk_insert(pages, [{"id": uuid4(), "slug": "reports", "title": "Отчёты", "route_pattern": "/v2/reports", "parent_id": root_id, "sort_order": 45, "content_markdown": "# Отчёты\n\nВ этом разделе формируются и скачиваются отчёты по программам и организациям."}])


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM documentation_pages WHERE slug = 'reports'"))

"""merge goal achievements and tax center heads

Revision ID: 0014_goal_tax_merge
Revises: 0013_goal_achievements, 0013_tax_center
Create Date: 2026-06-29 20:05:00.000000
"""

from alembic import op


revision = "0014_goal_tax_merge"
down_revision = ("0013_goal_achievements", "0013_tax_center")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

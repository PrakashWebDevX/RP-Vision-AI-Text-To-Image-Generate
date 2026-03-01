"""Initial tables for users, scripts, payments."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

# revision identifiers, used by Alembic.
revision: str = "20241117_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("plan", sa.String(length=50), nullable=False, server_default="free"),
        sa.Column("credits", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("language_pref", sa.String(length=5), nullable=False, server_default="en"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    op.create_table(
        "scripts",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("script_text", sa.Text(), nullable=False),
        sa.Column("seo_title", sa.String(length=160), nullable=False),
        sa.Column("seo_description", sa.Text(), nullable=False),
        sa.Column("hashtags", sa.JSON(), nullable=False),
        sa.Column("thumbnail_text", sa.JSON(), nullable=False),
        sa.Column("language", sa.String(length=5), nullable=False, server_default="en"),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "payments",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("gateway", sa.String(length=30), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("plan", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("order_id", sa.String(length=120), nullable=True),
        sa.Column("payment_id", sa.String(length=120), nullable=True),
        sa.Column("credits_added", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("scripts")
    op.drop_table("users")


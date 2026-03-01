import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base


class Script(Base):
    __tablename__ = "scripts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    topic: Mapped[str] = mapped_column(String(255))
    script_text: Mapped[str] = mapped_column(Text)
    seo_title: Mapped[str] = mapped_column(String(160))
    seo_description: Mapped[str] = mapped_column(Text)
    hashtags: Mapped[list[str]] = mapped_column(JSON)
    thumbnail_text: Mapped[list[str]] = mapped_column(JSON)
    language: Mapped[str] = mapped_column(String(5), default="en")
    word_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User | None"] = relationship("User", back_populates="scripts")




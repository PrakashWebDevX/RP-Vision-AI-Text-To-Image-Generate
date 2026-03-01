import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    gateway: Mapped[str] = mapped_column(String(30))
    amount: Mapped[int] = mapped_column(Integer)
    plan: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50))
    order_id: Mapped[str | None] = mapped_column(String(120))
    payment_id: Mapped[str | None] = mapped_column(String(120))
    credits_added: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="payments")




from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate


class UserService:
    """Encapsulates CRUD helpers for the User model."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def create_user(self, payload: UserCreate) -> User:
        user = User(
            name=payload.name,
            email=payload.email.lower(),
            password_hash=get_password_hash(payload.password),
            plan="free",
            credits=2,
        )
        self.session.add(user)
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ValueError("Email is already registered.") from exc
        self.session.refresh(user)
        return user

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email.lower())
        return self.session.execute(stmt).scalar_one_or_none()

    def verify_credentials(self, email: str, password: str) -> User | None:
        user = self.get_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self.session.get(User, user_id)


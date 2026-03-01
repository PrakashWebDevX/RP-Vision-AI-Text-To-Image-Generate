from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserCreate, UserRead


class SignUpRequest(UserCreate):
    """Extends UserCreate for semantic clarity."""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    tokens: TokenPair
    user: UserRead


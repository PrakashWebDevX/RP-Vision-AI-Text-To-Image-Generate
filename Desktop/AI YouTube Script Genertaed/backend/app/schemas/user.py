from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class UserRead(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    plan: str
    credits: int
    language_pref: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


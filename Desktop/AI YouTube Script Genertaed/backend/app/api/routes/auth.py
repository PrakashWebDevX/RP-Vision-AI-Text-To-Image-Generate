from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, create_refresh_token
from app.dependencies import get_db
from app.schemas.auth import AuthResponse, LoginRequest, SignUpRequest, TokenPair
from app.schemas.user import UserRead
from app.services.user_service import UserService

router = APIRouter(tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignUpRequest, session: Session = Depends(get_db)) -> AuthResponse:
    service = UserService(session)
    try:
        user = service.create_user(payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    tokens = _issue_tokens(user.id)
    return AuthResponse(tokens=tokens, user=UserRead.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, session: Session = Depends(get_db)) -> AuthResponse:
    service = UserService(session)
    user = service.verify_credentials(payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    tokens = _issue_tokens(user.id)
    return AuthResponse(tokens=tokens, user=UserRead.model_validate(user))


def _issue_tokens(user_id: UUID) -> TokenPair:
    access = create_access_token(str(user_id))
    refresh = create_refresh_token(str(user_id))
    return TokenPair(access_token=access, refresh_token=refresh)


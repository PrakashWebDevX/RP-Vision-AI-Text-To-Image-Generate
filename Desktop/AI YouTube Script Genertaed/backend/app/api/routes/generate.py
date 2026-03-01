from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_optional_user
from app.models.script import Script
from app.models.user import User
from app.schemas.generate import GenerateRequest, GenerateResponse
from app.services.openai_service import openai_service

router = APIRouter(prefix="/generate", tags=["generate"])


@router.post("", response_model=GenerateResponse, status_code=status.HTTP_200_OK)
async def generate_script(
    payload: GenerateRequest,
    session: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> GenerateResponse:
    try:
        result = await openai_service.generate_script(payload)
    except Exception as exc:  # pragma: no cover - placeholder for logging
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate script at this time.",
        ) from exc

    if user:
        script_entry = Script(
            user_id=user.id,
            topic=payload.topic,
            script_text=result.script,
            seo_title=result.seo_title,
            seo_description=result.seo_description,
            hashtags=result.hashtags,
            thumbnail_text=result.thumbnail_text,
            language=payload.language,
            word_count=result.word_count,
        )
        session.add(script_entry)
        session.commit()

    return result



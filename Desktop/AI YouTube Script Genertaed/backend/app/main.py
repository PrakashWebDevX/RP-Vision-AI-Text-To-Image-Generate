from fastapi import FastAPI

from app.api.routes.auth import router as auth_router
from app.api.routes.generate import router as generate_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI YouTube Script Generator API",
        version="0.1.0",
        description="Backend service for generating YouTube scripts and SEO assets.",
    )
    app.include_router(auth_router, prefix="/api")
    app.include_router(generate_router, prefix="/api")
    return app


app = create_app()



from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AI YouTube Script Generator"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_api_base: str = "https://api.openai.com/v1"
    openai_timeout: int = 45
    database_url: str = "sqlite:///./app.db"
    db_echo: bool = False
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_minutes: int = 60 * 24 * 7

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()



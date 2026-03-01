from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=200)
    length: str = Field(..., pattern="^(3min|5min|10min)$")
    language: str = Field(default="en", pattern="^(en|ta)$")


class GenerateResponse(BaseModel):
    script: str
    seo_title: str
    seo_description: str
    hashtags: list[str]
    thumbnail_text: list[str]
    word_count: int
    estimated_time: str



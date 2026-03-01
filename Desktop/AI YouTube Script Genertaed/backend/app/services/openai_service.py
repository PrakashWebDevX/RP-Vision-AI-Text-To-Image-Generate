from __future__ import annotations

import json
from dataclasses import dataclass, field

import httpx

from app.core.config import get_settings
from app.schemas.generate import GenerateRequest, GenerateResponse

PROMPT_SYSTEM = (
    "You are a professional YouTube content scriptwriter. Generate engaging, "
    "human-like scripts with hooks, pacing, storytelling, clear structure, and CTA."
)

PROMPT_TEMPLATE = """Return a JSON object with the following keys:
- script: full script with sections and line breaks
- seo_title: <=70 chars, keyword rich
- seo_description: 2 paragraphs + CTA
- hashtags: array of 10-20 hashtags
- thumbnail_text: array of 3 short (<=4 words) ideas

Topic: {topic}
Desired length: {length}
Language: {language}
"""

ESTIMATED_TIME = {
    "3min": "3m",
    "5min": "5m",
    "10min": "10m",
}


@dataclass
class OpenAIService:
    """Wrapper around OpenAI's Chat Completion API."""

    api_key: str | None = field(init=False, default=None)
    model: str = field(init=False, default="gpt-4o-mini")
    base_url: str = field(init=False, default="https://api.openai.com/v1")
    timeout: int = field(init=False, default=45)

    def __post_init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_api_base
        self.timeout = settings.openai_timeout

    async def generate_script(self, payload: GenerateRequest) -> GenerateResponse:
        if not self.api_key:
            return self._mock_response(payload)

        user_prompt = PROMPT_TEMPLATE.format(
            topic=payload.topic,
            length=self._length_label(payload.length),
            language="English" if payload.language == "en" else "Tamil",
        )

        data = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": PROMPT_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.7,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
            )
            response.raise_for_status()
            payload_json = response.json()

        raw_content = (
            payload_json.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        parsed = self._parse_content(raw_content)
        script = parsed.get("script", "").strip()

        return GenerateResponse(
            script=script,
            seo_title=parsed.get("seo_title", "Untitled Video"),
            seo_description=parsed.get(
                "seo_description",
                f"Discover insights on {payload.topic}.",
            ),
            hashtags=parsed.get("hashtags", ["#youtube", "#creator", "#ai"]),
            thumbnail_text=parsed.get(
                "thumbnail_text",
                ["Creator Mode", "Watch Now", "AI Script"],
            ),
            word_count=len(script.split()),
            estimated_time=ESTIMATED_TIME.get(payload.length, "5m"),
        )

    @staticmethod
    def _parse_content(content: str) -> dict[str, object]:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {}

    @staticmethod
    def _length_label(length: str) -> str:
        mapping = {"3min": "3 minutes", "5min": "5 minutes", "10min": "10 minutes"}
        return mapping.get(length, length)

    @staticmethod
    def _mock_response(payload: GenerateRequest) -> GenerateResponse:
        script = (
            f"[DEMO MODE] {payload.length} script in {payload.language} about {payload.topic}.\n"
            "Hook, story, value, CTA."
        )
        return GenerateResponse(
            script=script,
            seo_title=f"{payload.topic} – Complete Guide",
            seo_description=f"This video dives into {payload.topic}.",
            hashtags=["#youtube", "#creator", "#ai"],
            thumbnail_text=["Creator Hack", "Watch Now", "AI Script"],
            word_count=len(script.split()),
            estimated_time=ESTIMATED_TIME.get(payload.length, "5m"),
        )


openai_service = OpenAIService()



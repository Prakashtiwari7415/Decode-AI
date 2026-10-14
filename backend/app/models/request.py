"""Request schemas for lesson generation API endpoints."""

from pydantic import BaseModel, Field, field_validator
from app.models.common import ContentType, DetailLevel, Language
from app.utils.sanitizer import sanitize_content


class LessonRequest(BaseModel):
    """Payload sent by client to initiate structured lesson creation."""

    content: str = Field(
        ...,
        min_length=10,
        description="Source code, diff, prompt, or terminal log to explain (minimum 10 characters)",
    )
    content_type: ContentType = Field(
        default=ContentType.EXPLANATION,
        description="Classification of content",
    )
    language: Language = Field(
        default=Language.EN,
        description="Narration and instruction language",
    )
    detail_level: DetailLevel = Field(
        default=DetailLevel.STANDARD,
        description="Desired educational depth",
    )

    @field_validator("content")
    @classmethod
    def validate_content_payload(cls, value: str) -> str:
        """Validate length constraints and sanitize injection risks."""
        if value is None:
            raise ValueError("Content cannot be null or empty.")

        cleaned = sanitize_content(value)
        if len(cleaned) < 10:
            raise ValueError("Content must be at least 10 characters long.")

        return cleaned

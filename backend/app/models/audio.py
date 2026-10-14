"""Pydantic schemas defining narration and TTS audio contracts."""

from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models.common import Language

SUPPORTED_PREBUILT_VOICES: set[str] = {"Puck", "Charon", "Kore", "Fenrir", "Aoede"}


class NarrationRequest(BaseModel):
    """Payload for scene narration audio generation."""

    text: str = Field(
        ...,
        min_length=1,
        max_length=2500,
        description="Exact scene narration text to speak",
    )
    language: Language = Field(
        default=Language.EN,
        description="Narration language (en, hi, or hinglish)",
    )
    voice: str = Field(
        default="Puck",
        description="Prebuilt voice identifier (Puck, Charon, Kore, Fenrir, Aoede)",
    )
    is_fixture: bool = Field(
        default=False,
        description="If True, synthesizes offline deterministic WAV audio without requiring Gemini API credentials",
    )

    @field_validator("voice", mode="before")
    @classmethod
    def validate_voice(cls, value: Any) -> str:
        """Normalize voice name and validate against supported prebuilt voices."""
        if not isinstance(value, str):
            return "Puck"
        cleaned = value.strip().title()
        if cleaned in SUPPORTED_PREBUILT_VOICES:
            return cleaned
        # Default fallback
        return "Puck"

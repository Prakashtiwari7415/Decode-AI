"""Services layer for Gemini LLM orchestration, lesson synthesis, and TTS."""

from app.services.gemini_client import (
    GeminiClient,
    GeminiError,
    GeminiServiceUnavailableError,
)
from app.services.groq_client import GroqClient, GroqError
from app.services.lesson_builder import LessonBuilder, is_eligible_for_fallback

__all__ = [
    "GeminiClient",
    "GeminiError",
    "GeminiServiceUnavailableError",
    "GroqClient",
    "GroqError",
    "LessonBuilder",
    "is_eligible_for_fallback",
]

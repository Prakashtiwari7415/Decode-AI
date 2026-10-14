"""Unit tests for GeminiClient and structured output generation."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from google.genai.errors import APIError

from app.models.common import ContentType, DetailLevel, Language
from app.models.lesson import Lesson
from app.models.request import LessonRequest
from app.services.gemini_client import (
    GeminiAuthError,
    GeminiClient,
    GeminiModelOutputError,
    GeminiRateLimitError,
    GeminiTimeoutError,
)
from app.services.lesson_builder import LessonBuilder

VALID_AI_LESSON_JSON = """{
  "lesson_id": "lesson-mock-ai-123",
  "title": "Async IO Demystified",
  "language": "en",
  "content_type": "explanation",
  "total_estimated_duration_ms": 12000,
  "chapters": [
    {
      "chapter_id": "chap-1",
      "title": "Event Loops and Coroutines",
      "summary": "Learn how the event loop coordinates asynchronous tasks.",
      "scenes": [
        {
          "scene_id": "sc-1",
          "title": "What is an Event Loop?",
          "narration_text": "An event loop executes tasks cooperatively without blocking threads.",
          "visual": {
            "scene_type": "diagram",
            "highlighted_terms": ["Event Loop", "Coroutine"],
            "animation_style": "fade-slide"
          },
          "captions": [
            {
              "offset_ms": 0,
              "duration_ms": 4000,
              "text": "An event loop executes tasks cooperatively."
            }
          ],
          "uncertainty": "none"
        },
        {
          "scene_id": "sc-2",
          "title": "Sequential vs Async Code",
          "narration_text": "Switching from blocking calls to async await increases throughput.",
          "visual": {
            "scene_type": "code_diff",
            "before_code": "time.sleep(1)",
            "after_code": "await asyncio.sleep(1)",
            "language": "python",
            "highlighted_terms": ["asyncio", "await"],
            "animation_style": "highlight-sweep"
          },
          "captions": [
            {
              "offset_ms": 0,
              "duration_ms": 4000,
              "text": "Switching from blocking calls to async await."
            }
          ],
          "uncertainty": "none"
        }
      ]
    }
  ],
  "glossary": [
    {
      "term": "Event Loop",
      "definition": "The core execution mechanism in asyncio that manages callbacks."
    }
  ],
  "verification_checklist": [
    {
      "id": "chk-01",
      "statement": "Ensure blocking CPU tasks are delegated to process pools.",
      "importance": "must-know"
    }
  ],
  "gemini_model_version": "gemini-3.8-flash",
  "generated_at": "2026-10-15T00:00:00Z"
}"""


@pytest.mark.asyncio
async def test_missing_or_placeholder_key_raises_auth_error() -> None:
    """Verify initialization or call with placeholder key raises GeminiAuthError."""
    client = GeminiClient(api_key="dev-placeholder-key")
    with pytest.raises(GeminiAuthError, match="Gemini API key is missing or set to placeholder"):
        await client.generate_lesson("Explain async io")


@pytest.mark.asyncio
async def test_successful_gemini_generation_returns_validated_lesson() -> None:
    """Verify valid Gemini JSON response is parsed into an enriched Lesson."""
    client = GeminiClient(api_key="real-simulated-key-123456789")

    mock_response = MagicMock()
    mock_response.text = VALID_AI_LESSON_JSON

    with patch.object(
        client._client.aio.models,
        "generate_content",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        lesson = await client.generate_lesson("Explain async io")

        assert isinstance(lesson, Lesson)
        assert lesson.title == "Async IO Demystified"
        assert len(lesson.chapters) == 1
        assert len(lesson.chapters[0].scenes) == 2
        assert lesson.gemini_model_version == "gemini-3.8-flash"
        assert lesson.total_estimated_duration_ms > 0


@pytest.mark.asyncio
async def test_malformed_json_raises_model_output_error() -> None:
    """Verify malformed JSON from model raises GeminiModelOutputError."""
    client = GeminiClient(api_key="real-simulated-key-123456789")

    mock_response = MagicMock()
    mock_response.text = "{ not valid json at all ... "

    with patch.object(
        client._client.aio.models,
        "generate_content",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        with pytest.raises(GeminiModelOutputError, match="not valid JSON"):
            await client.generate_lesson("prompt")


@pytest.mark.asyncio
async def test_empty_response_raises_model_output_error() -> None:
    """Verify empty response text raises GeminiModelOutputError."""
    client = GeminiClient(api_key="real-simulated-key-123456789")

    mock_response = MagicMock()
    mock_response.text = ""

    with patch.object(
        client._client.aio.models,
        "generate_content",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        with pytest.raises(GeminiModelOutputError, match="empty response"):
            await client.generate_lesson("prompt")


@pytest.mark.asyncio
async def test_rate_limit_429_raises_gemini_rate_limit_error() -> None:
    """Verify HTTP 429 APIError is mapped to GeminiRateLimitError."""
    client = GeminiClient(api_key="real-simulated-key-123456789")

    api_error = APIError(429, {"error": {"message": "Resource exhausted"}})

    with patch.object(
        client._client.aio.models,
        "generate_content",
        new_callable=AsyncMock,
        side_effect=api_error,
    ):
        with pytest.raises(GeminiRateLimitError, match="rate limit or quota exceeded"):
            await client.generate_lesson("prompt")


@pytest.mark.asyncio
async def test_timeout_raises_gemini_timeout_error() -> None:
    """Verify asyncio.TimeoutError is mapped to GeminiTimeoutError."""
    client = GeminiClient(api_key="real-simulated-key-123456789", timeout_seconds=0.01)

    async def slow_generate(*args, **kwargs):
        await asyncio.sleep(0.5)

    with patch.object(
        client._client.aio.models,
        "generate_content",
        side_effect=slow_generate,
    ):
        with pytest.raises(GeminiTimeoutError, match="timed out"):
            await client.generate_lesson("prompt")


@pytest.mark.asyncio
async def test_lesson_builder_multilingual_renders_prompt() -> None:
    """Verify LessonBuilder correctly renders prompts for en, hi, and hinglish."""
    mock_client = MagicMock()
    mock_client.generate_lesson = AsyncMock(
        return_value=Lesson.model_validate_json(VALID_AI_LESSON_JSON)
    )

    builder = LessonBuilder(gemini_client=mock_client)

    for lang in [Language.EN, Language.HI, Language.HINGLISH]:
        req = LessonRequest(
            content="def add(a, b): return a + b",
            content_type=ContentType.EXPLANATION,
            language=lang,
            detail_level=DetailLevel.STANDARD,
            use_fixture=False,
        )
        res = await builder.build(req)
        assert res.title == "Async IO Demystified"
        mock_client.generate_lesson.assert_called()
        prompt_arg = mock_client.generate_lesson.call_args[0][0]
        assert "def add(a, b): return a + b" in prompt_arg
        assert lang.value in prompt_arg

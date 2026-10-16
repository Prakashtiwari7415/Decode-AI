"""Unit tests for GroqClient and structured output generation."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from openai import InternalServerError, RateLimitError

from app.models.lesson import Lesson
from app.services.groq_client import (
    GroqAuthError,
    GroqClient,
    GroqModelOutputError,
    GroqRateLimitError,
    GroqTimeoutError,
    GroqUnavailableError,
)

VALID_GROQ_LESSON_JSON = """{
  "lesson_id": "lesson-groq-mock-123",
  "title": "Groq Accelerated Lesson",
  "language": "en",
  "content_type": "explanation",
  "total_estimated_duration_ms": 14000,
  "chapters": [
    {
      "chapter_id": "chap-1",
      "title": "Groq Architecture Chapter",
      "summary": "Exploring fast inference and structured outputs.",
      "scenes": [
        {
          "scene_id": "sc-1",
          "title": "Inference Speedup",
          "narration_text": "Groq LPUs deliver deterministic high-speed streaming inference.",
          "visual": {
            "scene_type": "text",
            "highlighted_terms": ["Groq", "LPU"],
            "animation_style": "fade-slide"
          },
          "captions": [
            {
              "offset_ms": 0,
              "duration_ms": 5000,
              "text": "Groq LPUs deliver deterministic high-speed inference."
            }
          ],
          "uncertainty": "none",
          "grounding_category": "observed",
          "what_to_verify": ["Verify latency in local benchmarks."]
        }
      ]
    }
  ],
  "glossary": [
    {
      "term": "LPU",
      "definition": "Language Processing Unit designed for tensor streaming."
    }
  ],
  "verification_checklist": [
    {
      "id": "chk-01",
      "statement": "Confirm API endpoint compatibility with OpenAI client specification.",
      "importance": "must-know",
      "grounding": "observed"
    }
  ],
  "gemini_model_version": "groq/openai/gpt-oss-120b",
  "generated_at": "2026-10-16T00:00:00Z"
}"""


@pytest.mark.asyncio
async def test_groq_client_missing_or_placeholder_key_raises_auth_error() -> None:
    """Verify GroqClient raises GroqAuthError when initialized with empty or placeholder key."""
    client = GroqClient(api_key="your_groq_api_key_here")
    with pytest.raises(GroqAuthError, match="Groq API key is missing or set to placeholder"):
        await client.generate_lesson("Explain async io")

    client_empty = GroqClient(api_key="")
    with pytest.raises(GroqAuthError, match="Groq API key is missing or set to placeholder"):
        await client_empty.generate_lesson("Explain async io")


@pytest.mark.asyncio
async def test_groq_client_successful_generation_returns_validated_lesson() -> None:
    """Verify valid JSON returned by Groq is parsed and enriched into a valid Lesson model."""
    client = GroqClient(api_key="gsk_mock_valid_key_for_testing_12345")

    mock_choice = MagicMock()
    mock_choice.message.content = VALID_GROQ_LESSON_JSON
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch.object(
        client._client.chat.completions,
        "create",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        lesson = await client.generate_lesson("Explain async io")

        assert isinstance(lesson, Lesson)
        assert lesson.title == "Groq Accelerated Lesson"
        assert len(lesson.chapters) == 1
        assert len(lesson.chapters[0].scenes) == 1
        assert "groq" in lesson.gemini_model_version.lower()
        assert lesson.total_estimated_duration_ms > 0
        assert getattr(lesson, "_timing_metrics", {}).get("provider") == "groq"


@pytest.mark.asyncio
async def test_groq_client_strips_markdown_code_fences() -> None:
    """Verify that JSON wrapped in markdown code fences is cleaned and parsed successfully."""
    client = GroqClient(api_key="gsk_mock_valid_key_for_testing_12345")

    fenced_json = f"```json\n{VALID_GROQ_LESSON_JSON}\n```"
    mock_choice = MagicMock()
    mock_choice.message.content = fenced_json
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch.object(
        client._client.chat.completions,
        "create",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        lesson = await client.generate_lesson("Explain async io")
        assert isinstance(lesson, Lesson)
        assert lesson.title == "Groq Accelerated Lesson"


@pytest.mark.asyncio
async def test_groq_client_malformed_json_raises_model_output_error() -> None:
    """Verify that malformed JSON returned by Groq raises GroqModelOutputError."""
    client = GroqClient(api_key="gsk_mock_valid_key_for_testing_12345")

    mock_choice = MagicMock()
    mock_choice.message.content = "{ broken: json without quotes ... "
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch.object(
        client._client.chat.completions,
        "create",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        with pytest.raises(GroqModelOutputError, match="not valid JSON"):
            await client.generate_lesson("prompt")


@pytest.mark.asyncio
async def test_groq_client_empty_response_raises_model_output_error() -> None:
    """Verify that empty response content raises GroqModelOutputError."""
    client = GroqClient(api_key="gsk_mock_valid_key_for_testing_12345")

    mock_choice = MagicMock()
    mock_choice.message.content = ""
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch.object(
        client._client.chat.completions,
        "create",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        with pytest.raises(GroqModelOutputError, match="empty response"):
            await client.generate_lesson("prompt")


@pytest.mark.asyncio
async def test_groq_client_rate_limit_raises_groq_rate_limit_error() -> None:
    """Verify OpenAI RateLimitError is converted to GroqRateLimitError."""
    client = GroqClient(api_key="gsk_mock_valid_key_for_testing_12345")

    mock_response = MagicMock()
    mock_response.status_code = 429
    err = RateLimitError(
        message="Rate limit exceeded",
        response=mock_response,
        body={"error": {"message": "Rate limit exceeded"}},
    )

    with patch.object(
        client._client.chat.completions,
        "create",
        new_callable=AsyncMock,
        side_effect=err,
    ):
        with pytest.raises(GroqRateLimitError, match="rate limit or quota exceeded"):
            await client.generate_lesson("prompt")


@pytest.mark.asyncio
async def test_groq_client_timeout_raises_groq_timeout_error() -> None:
    """Verify timeout is converted to GroqTimeoutError."""
    client = GroqClient(api_key="gsk_mock_valid_key_for_testing_12345", timeout_seconds=0.01)

    async def slow_generate(*args, **kwargs):
        await asyncio.sleep(0.5)

    with patch.object(
        client._client.chat.completions,
        "create",
        side_effect=slow_generate,
    ):
        with pytest.raises(GroqTimeoutError, match="timed out"):
            await client.generate_lesson("prompt")


@pytest.mark.asyncio
async def test_groq_client_server_error_raises_groq_unavailable_error() -> None:
    """Verify InternalServerError is converted to GroqUnavailableError."""
    client = GroqClient(api_key="gsk_mock_valid_key_for_testing_12345")

    mock_response = MagicMock()
    mock_response.status_code = 503
    err = InternalServerError(
        message="Service Unavailable",
        response=mock_response,
        body={"error": {"message": "Service Unavailable"}},
    )

    with patch.object(
        client._client.chat.completions,
        "create",
        new_callable=AsyncMock,
        side_effect=err,
    ):
        with pytest.raises(GroqUnavailableError, match="temporarily unavailable"):
            await client.generate_lesson("prompt")

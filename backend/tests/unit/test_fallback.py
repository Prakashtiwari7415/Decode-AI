"""Comprehensive tests for Gemini primary with Groq automatic fallback.

Verifies all 10 required test scenarios:
1. Gemini succeeds — Groq is never called.
2. Gemini returns 429 — Groq succeeds.
3. Gemini returns 503 — Groq succeeds.
4. Gemini times out — eligible fallback works.
5. Gemini returns 401 — Groq is not called.
6. Gemini returns invalid structured output — bounded fallback behavior works.
7. Both providers fail — clear error is returned.
8. Groq output passes the existing lesson schema and grounding checks.
9. Fixture mode never calls either provider.
10. No unbounded retries or duplicate fallback calls occur.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from google.genai.errors import APIError

from app.models.common import ContentType, DetailLevel, GroundingCategory, Language
from app.models.lesson import Lesson
from app.models.request import LessonRequest
from app.services.gemini_client import (
    GeminiAuthError,
    GeminiClient,
    GeminiError,
    GeminiModelOutputError,
    GeminiRateLimitError,
    GeminiServiceUnavailableError,
    GeminiTimeoutError,
)
from app.services.groq_client import (
    GroqClient,
    GroqError,
    GroqRateLimitError,
)
from app.services.lesson_builder import LessonBuilder, is_eligible_for_fallback
from app.services.quality_validator import LessonQualityError

SAMPLE_LESSON_JSON = """{
  "lesson_id": "lesson-sample-01",
  "title": "Understanding Python Decorators",
  "language": "en",
  "content_type": "explanation",
  "total_estimated_duration_ms": 10000,
  "chapters": [
    {
      "chapter_id": "chap-01",
      "title": "Decorator Basics",
      "summary": "How functions wrap other functions.",
      "scenes": [
        {
          "scene_id": "scene-01",
          "title": "What is a Decorator?",
          "narration_text": "A decorator modifies the behavior of a function without altering its source.",
          "visual": {
            "scene_type": "text",
            "highlighted_terms": ["decorator", "closure"],
            "animation_style": "fade-slide"
          },
          "captions": [
            {
              "offset_ms": 0,
              "duration_ms": 5000,
              "text": "A decorator modifies the behavior of a function."
            }
          ],
          "uncertainty": "none",
          "grounding_category": "observed",
          "what_to_verify": ["Confirm signature preservation with functools.wraps."]
        }
      ]
    }
  ],
  "glossary": [
    {
      "term": "Decorator",
      "definition": "A higher-order function that takes another function and extends its behavior."
    }
  ],
  "verification_checklist": [
    {
      "id": "chk-01",
      "statement": "Check that kwargs are properly forwarded in the wrapper function.",
      "importance": "must-know",
      "grounding": "observed"
    }
  ],
  "gemini_model_version": "gemini-3.8-flash",
  "generated_at": "2026-10-16T00:00:00Z"
}"""


def create_sample_lesson(model_version: str = "gemini-3.8-flash") -> Lesson:
    lesson = Lesson.model_validate_json(SAMPLE_LESSON_JSON)
    lesson.gemini_model_version = model_version
    return lesson


def create_test_request(use_fixture: bool = False) -> LessonRequest:
    return LessonRequest(
        content="def my_decorator(func): pass",
        content_type=ContentType.EXPLANATION,
        language=Language.EN,
        detail_level=DetailLevel.STANDARD,
        use_fixture=use_fixture,
    )


# ---------------------------------------------------------------------------
# Test 1: Gemini succeeds — Groq is never called
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_1_gemini_succeeds_groq_never_called() -> None:
    mock_gemini = MagicMock(spec=GeminiClient)
    mock_gemini.model_name = "gemini-3.8-flash"
    mock_gemini.generate_lesson = AsyncMock(return_value=create_sample_lesson("gemini-3.8-flash"))

    mock_groq = MagicMock(spec=GroqClient)
    mock_groq.model_name = "openai/gpt-oss-120b"
    mock_groq.is_configured.return_value = True
    mock_groq.generate_lesson = AsyncMock()

    builder = LessonBuilder(gemini_client=mock_gemini, groq_client=mock_groq)
    lesson = await builder.build(create_test_request())

    assert lesson.gemini_model_version == "gemini-3.8-flash"
    mock_gemini.generate_lesson.assert_called_once()
    mock_groq.generate_lesson.assert_not_called()


# ---------------------------------------------------------------------------
# Test 2: Gemini returns 429 — Groq succeeds
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_2_gemini_returns_429_groq_succeeds() -> None:
    mock_gemini = MagicMock(spec=GeminiClient)
    mock_gemini.model_name = "gemini-3.8-flash"
    mock_gemini.generate_lesson = AsyncMock(
        side_effect=GeminiRateLimitError("Gemini quota exhausted")
    )

    mock_groq = MagicMock(spec=GroqClient)
    mock_groq.model_name = "openai/gpt-oss-120b"
    mock_groq.is_configured.return_value = True
    mock_groq.generate_lesson = AsyncMock(
        return_value=create_sample_lesson("groq/openai/gpt-oss-120b")
    )

    builder = LessonBuilder(gemini_client=mock_gemini, groq_client=mock_groq)
    lesson = await builder.build(create_test_request())

    mock_gemini.generate_lesson.assert_called_once()
    mock_groq.generate_lesson.assert_called_once()
    assert "groq" in lesson.gemini_model_version.lower()
    timings = getattr(lesson, "_timing_metrics", {})
    assert timings.get("fallback_used") is True
    assert timings.get("fallback_reason") == "rate_limit_429"


# ---------------------------------------------------------------------------
# Test 3: Gemini returns 503 — Groq succeeds
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_3_gemini_returns_503_groq_succeeds() -> None:
    mock_gemini = MagicMock(spec=GeminiClient)
    mock_gemini.model_name = "gemini-3.8-flash"
    mock_gemini.generate_lesson = AsyncMock(
        side_effect=GeminiServiceUnavailableError("Gemini high demand 503")
    )

    mock_groq = MagicMock(spec=GroqClient)
    mock_groq.model_name = "openai/gpt-oss-120b"
    mock_groq.is_configured.return_value = True
    mock_groq.generate_lesson = AsyncMock(
        return_value=create_sample_lesson("groq/openai/gpt-oss-120b")
    )

    builder = LessonBuilder(gemini_client=mock_gemini, groq_client=mock_groq)
    lesson = await builder.build(create_test_request())

    mock_gemini.generate_lesson.assert_called_once()
    mock_groq.generate_lesson.assert_called_once()
    assert "groq" in lesson.gemini_model_version.lower()
    timings = getattr(lesson, "_timing_metrics", {})
    assert timings.get("fallback_reason") == "service_unavailable_503"


# ---------------------------------------------------------------------------
# Test 4: Gemini times out — eligible fallback works
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_4_gemini_times_out_groq_succeeds() -> None:
    mock_gemini = MagicMock(spec=GeminiClient)
    mock_gemini.model_name = "gemini-3.8-flash"
    mock_gemini.generate_lesson = AsyncMock(side_effect=GeminiTimeoutError("Gemini timed out"))

    mock_groq = MagicMock(spec=GroqClient)
    mock_groq.model_name = "openai/gpt-oss-120b"
    mock_groq.is_configured.return_value = True
    mock_groq.generate_lesson = AsyncMock(
        return_value=create_sample_lesson("groq/openai/gpt-oss-120b")
    )

    builder = LessonBuilder(gemini_client=mock_gemini, groq_client=mock_groq)
    lesson = await builder.build(create_test_request())

    mock_gemini.generate_lesson.assert_called_once()
    mock_groq.generate_lesson.assert_called_once()
    timings = getattr(lesson, "_timing_metrics", {})
    assert timings.get("fallback_reason") == "transient_timeout"


# ---------------------------------------------------------------------------
# Test 5: Gemini returns 401 — Groq is not called
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_5_gemini_returns_401_groq_not_called() -> None:
    mock_gemini = MagicMock(spec=GeminiClient)
    mock_gemini.model_name = "gemini-3.8-flash"
    mock_gemini.generate_lesson = AsyncMock(side_effect=GeminiAuthError("Invalid Gemini API key"))

    mock_groq = MagicMock(spec=GroqClient)
    mock_groq.model_name = "openai/gpt-oss-120b"
    mock_groq.is_configured.return_value = True
    mock_groq.generate_lesson = AsyncMock()

    builder = LessonBuilder(gemini_client=mock_gemini, groq_client=mock_groq)
    with pytest.raises(GeminiAuthError, match="Invalid Gemini API key"):
        await builder.build(create_test_request())

    mock_gemini.generate_lesson.assert_called_once()
    mock_groq.generate_lesson.assert_not_called()


# ---------------------------------------------------------------------------
# Test 6: Gemini returns invalid structured output — bounded fallback behavior works
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_6_gemini_invalid_output_groq_succeeds() -> None:
    mock_gemini = MagicMock(spec=GeminiClient)
    mock_gemini.model_name = "gemini-3.8-flash"
    mock_gemini.generate_lesson = AsyncMock(
        side_effect=GeminiModelOutputError("Invalid JSON structure")
    )

    mock_groq = MagicMock(spec=GroqClient)
    mock_groq.model_name = "openai/gpt-oss-120b"
    mock_groq.is_configured.return_value = True
    mock_groq.generate_lesson = AsyncMock(
        return_value=create_sample_lesson("groq/openai/gpt-oss-120b")
    )

    builder = LessonBuilder(gemini_client=mock_gemini, groq_client=mock_groq)
    lesson = await builder.build(create_test_request())

    mock_gemini.generate_lesson.assert_called_once()
    mock_groq.generate_lesson.assert_called_once()
    timings = getattr(lesson, "_timing_metrics", {})
    assert timings.get("fallback_reason") == "output_validation_failure"


# ---------------------------------------------------------------------------
# Test 7: Both providers fail — clear error is returned
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_7_both_providers_fail_returns_clear_error() -> None:
    mock_gemini = MagicMock(spec=GeminiClient)
    mock_gemini.model_name = "gemini-3.8-flash"
    mock_gemini.generate_lesson = AsyncMock(side_effect=GeminiRateLimitError("Gemini 429"))

    mock_groq = MagicMock(spec=GroqClient)
    mock_groq.model_name = "openai/gpt-oss-120b"
    mock_groq.is_configured.return_value = True
    mock_groq.generate_lesson = AsyncMock(side_effect=GroqError("Groq 500 internal error"))

    builder = LessonBuilder(gemini_client=mock_gemini, groq_client=mock_groq)
    with pytest.raises(GeminiError) as exc_info:
        await builder.build(create_test_request())

    assert exc_info.value.status_code == 502
    assert "Both primary and fallback AI generation providers failed" in exc_info.value.detail
    mock_gemini.generate_lesson.assert_called_once()
    mock_groq.generate_lesson.assert_called_once()


# ---------------------------------------------------------------------------
# Test 8: Groq output passes the existing lesson schema and grounding checks
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_8_groq_output_passes_schema_and_grounding_checks() -> None:
    mock_gemini = MagicMock(spec=GeminiClient)
    mock_gemini.model_name = "gemini-3.8-flash"
    mock_gemini.generate_lesson = AsyncMock(side_effect=GeminiRateLimitError("Gemini 429"))

    groq_lesson = create_sample_lesson("groq/openai/gpt-oss-120b")
    mock_groq = MagicMock(spec=GroqClient)
    mock_groq.model_name = "openai/gpt-oss-120b"
    mock_groq.is_configured.return_value = True
    mock_groq.generate_lesson = AsyncMock(return_value=groq_lesson)

    builder = LessonBuilder(gemini_client=mock_gemini, groq_client=mock_groq)
    lesson = await builder.build(create_test_request())

    assert isinstance(lesson, Lesson)
    assert lesson.title == "Understanding Python Decorators"
    scene = lesson.chapters[0].scenes[0]
    assert scene.scene_id == "scene-01"
    assert scene.grounding_category == GroundingCategory.OBSERVED
    assert len(scene.captions) >= 1
    assert scene.captions[0].duration_ms > 0
    assert len(lesson.verification_checklist) >= 1
    assert lesson.verification_checklist[0].grounding == GroundingCategory.OBSERVED


# ---------------------------------------------------------------------------
# Test 9: Fixture mode never calls either provider
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_9_fixture_mode_never_calls_either_provider() -> None:
    mock_gemini = MagicMock(spec=GeminiClient)
    mock_gemini.generate_lesson = AsyncMock()

    mock_groq = MagicMock(spec=GroqClient)
    mock_groq.is_configured.return_value = True
    mock_groq.generate_lesson = AsyncMock()

    builder = LessonBuilder(gemini_client=mock_gemini, groq_client=mock_groq)
    fixture_req = create_test_request(use_fixture=True)
    lesson = await builder.build(fixture_req)

    assert lesson.lesson_id.startswith("lesson-fixture")
    mock_gemini.generate_lesson.assert_not_called()
    mock_groq.generate_lesson.assert_not_called()


# ---------------------------------------------------------------------------
# Test 10: No unbounded retries or duplicate fallback calls occur
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_10_no_unbounded_retries_or_duplicate_fallback_calls() -> None:
    mock_gemini = MagicMock(spec=GeminiClient)
    mock_gemini.model_name = "gemini-3.8-flash"
    mock_gemini.generate_lesson = AsyncMock(side_effect=GeminiRateLimitError("Rate limit 429"))

    mock_groq = MagicMock(spec=GroqClient)
    mock_groq.model_name = "openai/gpt-oss-120b"
    mock_groq.is_configured.return_value = True
    mock_groq.generate_lesson = AsyncMock(side_effect=GroqRateLimitError("Groq Rate limit 429"))

    builder = LessonBuilder(gemini_client=mock_gemini, groq_client=mock_groq)

    with pytest.raises(GeminiError):
        await builder.build(create_test_request())

    # Exactly 1 primary call and exactly 1 fallback call, strictly bounded
    assert mock_gemini.generate_lesson.call_count == 1
    assert mock_groq.generate_lesson.call_count == 1


# ---------------------------------------------------------------------------
# Unit tests for is_eligible_for_fallback rule coverage
# ---------------------------------------------------------------------------
def test_is_eligible_for_fallback_classification() -> None:
    # Ineligible
    assert is_eligible_for_fallback(GeminiAuthError()) == (False, "auth_failure")
    assert is_eligible_for_fallback(APIError(401, {"error": {}})) == (False, "auth_failure")
    assert is_eligible_for_fallback(APIError(403, {"error": {}})) == (False, "auth_failure")
    assert is_eligible_for_fallback(APIError(400, {"error": {}})) == (False, "invalid_request")
    assert is_eligible_for_fallback(ValueError("bad value")) == (False, "invalid_parameters")

    # Eligible
    assert is_eligible_for_fallback(GeminiRateLimitError()) == (True, "rate_limit_429")
    assert is_eligible_for_fallback(APIError(429, {"error": {}})) == (True, "rate_limit_429")
    assert is_eligible_for_fallback(GeminiServiceUnavailableError()) == (
        True,
        "service_unavailable_503",
    )
    assert is_eligible_for_fallback(APIError(503, {"error": {}})) == (
        True,
        "service_unavailable_503",
    )
    assert is_eligible_for_fallback(GeminiTimeoutError()) == (True, "transient_timeout")
    assert is_eligible_for_fallback(TimeoutError()) == (True, "transient_timeout")
    assert is_eligible_for_fallback(APIError(504, {"error": {}})) == (True, "transient_timeout")
    assert is_eligible_for_fallback(GeminiModelOutputError()) == (True, "output_validation_failure")
    assert is_eligible_for_fallback(LessonQualityError("bad schema")) == (
        True,
        "output_validation_failure",
    )
    assert is_eligible_for_fallback(GeminiError("service down", status_code=502)) == (
        True,
        "upstream_service_error",
    )

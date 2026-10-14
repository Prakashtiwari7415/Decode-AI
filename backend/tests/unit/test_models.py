"""Unit tests for Pydantic data models."""

import pytest
from pydantic import ValidationError

from app.models.common import ContentType, DetailLevel, Language
from app.models.lesson import Lesson
from app.models.request import LessonRequest
from app.services.lesson_builder import LessonBuilder


def test_valid_lesson_request_construction() -> None:
    """Verify that a well-formed LessonRequest constructs successfully."""
    payload = LessonRequest(
        content="def binary_search(arr, x):\n    return -1",
        content_type=ContentType.EXPLANATION,
        language=Language.EN,
        detail_level=DetailLevel.STANDARD,
    )
    assert payload.content == "def binary_search(arr, x):\n    return -1"
    assert payload.content_type == ContentType.EXPLANATION
    assert payload.language == Language.EN
    assert payload.detail_level == DetailLevel.STANDARD


def test_lesson_request_rejects_content_shorter_than_10_chars() -> None:
    """Verify that content shorter than 10 characters raises a ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        LessonRequest(
            content="short",
            content_type=ContentType.EXPLANATION,
            language=Language.EN,
            detail_level=DetailLevel.STANDARD,
        )
    assert "at least 10 characters" in str(exc_info.value)


def test_lesson_request_rejects_script_injection() -> None:
    """Verify that content containing <script tags raises a ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        LessonRequest(
            content="<script>alert('xss vulnerability')</script>",
            content_type=ContentType.EXPLANATION,
            language=Language.EN,
            detail_level=DetailLevel.STANDARD,
        )
    assert "Prohibited pattern detected" in str(exc_info.value) or "<script" in str(exc_info.value)


def test_lesson_fixture_round_trips_through_json() -> None:
    """Verify that a generated Lesson fixture serializes and deserializes without data loss."""
    builder = LessonBuilder()
    req = LessonRequest(
        content="const sum = (a: number, b: number): number => a + b;",
        content_type=ContentType.CODE_DIFF,
        language=Language.EN,
        detail_level=DetailLevel.STANDARD,
    )
    lesson = builder.build_fixture(req)

    # Serialize to JSON string
    json_data = lesson.model_dump_json()
    assert isinstance(json_data, str)

    # Deserialize back into Lesson model
    restored = Lesson.model_validate_json(json_data)
    assert restored.lesson_id == lesson.lesson_id
    assert restored.title == lesson.title
    assert restored.language == lesson.language
    assert len(restored.chapters) == len(lesson.chapters)
    assert len(restored.chapters[0].scenes) == 2
    assert len(restored.glossary) == 2
    assert len(restored.verification_checklist) == 2

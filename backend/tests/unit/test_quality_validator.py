"""Unit tests for DecodeAI lesson quality validator and anti-hallucination engine."""

import pytest

from app.models.common import (
    AnimationStyle,
    ContentType,
    GroundingCategory,
    Language,
    SceneType,
    UncertaintyLevel,
    VerificationImportance,
)
from app.models.lesson import (
    Caption,
    Chapter,
    GlossaryEntry,
    Lesson,
    Scene,
    VerificationItem,
    VisualSpec,
)
from app.services.quality_validator import (
    LessonQualityError,
    is_incomplete_input,
    sanitize_execution_claims,
    validate_and_sanitize_lesson_quality,
)


def create_minimal_lesson(
    scenes: list[Scene] | None = None,
    chapters: list[Chapter] | None = None,
    narration_text: str = "This explains how python loops execute.",
) -> Lesson:
    """Helper to build a valid base Lesson for validator testing."""
    if scenes is None:
        scenes = [
            Scene(
                scene_id="sc-01",
                title="Introductory Concept",
                narration_text=narration_text,
                visual=VisualSpec(
                    scene_type=SceneType.TEXT,
                    highlighted_terms=["python", "loop"],
                    animation_style=AnimationStyle.FADE_SLIDE,
                ),
                captions=[Caption(offset_ms=0, duration_ms=4000, text=narration_text)],
                uncertainty=UncertaintyLevel.NONE,
                grounding_category=GroundingCategory.OBSERVED,
            )
        ]

    if chapters is None:
        chapters = [
            Chapter(
                chapter_id="chap-01",
                title="Fundamentals",
                summary="Basic execution concepts",
                scenes=scenes,
            )
        ]

    return Lesson(
        lesson_id="test-lesson-quality",
        title="Python Loop Fundamentals",
        language=Language.EN,
        content_type=ContentType.EXPLANATION,
        total_estimated_duration_ms=4000,
        chapters=chapters,
        glossary=[
            GlossaryEntry(term="Loop", definition="Iterative execution block", example="for x in y:")
        ],
        verification_checklist=[
            VerificationItem(
                id="chk-01",
                statement="Verify iterable is non-empty before processing",
                importance=VerificationImportance.MUST_KNOW,
                grounding=GroundingCategory.NEEDS_VERIFICATION,
            )
        ],
        gemini_model_version="gemini-3.8-flash",
        generated_at="2026-10-15T00:00:00Z",
    )


def test_sanitize_execution_claims_detects_and_replaces_hallucinations() -> None:
    text_with_claim = "I ran this code and confirmed that the array is transformed."
    cleaned, modified = sanitize_execution_claims(text_with_claim)
    assert modified is True
    assert "i ran this code" not in cleaned.lower()
    assert "Static code analysis indicates" in cleaned

    text_tested_server = "This fix was tested on our server with 100 iterations."
    cleaned_server, modified_server = sanitize_execution_claims(text_tested_server)
    assert modified_server is True
    assert "tested on our server" not in cleaned_server.lower()


def test_is_incomplete_input_heuristics() -> None:
    # Short single-line input
    assert is_incomplete_input("500 Internal Server Error") is True
    assert is_incomplete_input("KeyError: 'user_id'") is True
    assert is_incomplete_input("") is True
    assert is_incomplete_input(None) is True

    # Complete multi-line code snippet
    full_code = """
def fetch_user_data(user_id: int) -> dict:
    if user_id <= 0:
        raise ValueError("Invalid user_id")
    response = db.query(User).filter_by(id=user_id).first()
    return response.to_dict()
"""
    assert is_incomplete_input(full_code) is False


def test_quality_validator_upgrades_uncertainty_for_incomplete_input() -> None:
    lesson = create_minimal_lesson()
    assert lesson.chapters[0].scenes[0].uncertainty == UncertaintyLevel.NONE

    # Incomplete single-line input
    validated = validate_and_sanitize_lesson_quality(
        lesson, user_content="TypeError: cannot unpack non-iterable NoneType object"
    )

    first_scene = validated.chapters[0].scenes[0]
    assert first_scene.uncertainty == UncertaintyLevel.MEDIUM
    assert first_scene.uncertainty_note is not None
    assert "isolated snippet" in first_scene.uncertainty_note.lower()


def test_quality_validator_deduplicates_scene_and_chapter_ids() -> None:
    dup_scene_1 = Scene(
        scene_id="duplicate-id",
        title="Scene 1",
        narration_text="Explanation scene 1",
        visual=VisualSpec(scene_type=SceneType.TEXT, highlighted_terms=[]),
    )
    dup_scene_2 = Scene(
        scene_id="duplicate-id",
        title="Scene 2",
        narration_text="Explanation scene 2",
        visual=VisualSpec(scene_type=SceneType.TEXT, highlighted_terms=[]),
    )

    chap1 = Chapter(
        chapter_id="dup-chap",
        title="Chapter 1",
        summary="Summary 1",
        scenes=[dup_scene_1],
    )
    chap2 = Chapter(
        chapter_id="dup-chap",
        title="Chapter 2",
        summary="Summary 2",
        scenes=[dup_scene_2],
    )

    lesson = create_minimal_lesson(chapters=[chap1, chap2])
    validated = validate_and_sanitize_lesson_quality(lesson)

    # Chapters must now have unique IDs
    assert validated.chapters[0].chapter_id != validated.chapters[1].chapter_id
    # Scenes must now have unique IDs
    assert (
        validated.chapters[0].scenes[0].scene_id != validated.chapters[1].scenes[0].scene_id
    )


def test_quality_validator_repairs_invalid_mermaid_syntax() -> None:
    scene_with_bad_mermaid = Scene(
        scene_id="sc-bad-mermaid",
        title="Architecture",
        narration_text="Understanding system architecture.",
        visual=VisualSpec(
            scene_type=SceneType.DIAGRAM,
            mermaid_definition="invalid syntax with no graph directive",
            highlighted_terms=[],
        ),
    )
    lesson = create_minimal_lesson(scenes=[scene_with_bad_mermaid])
    validated = validate_and_sanitize_lesson_quality(lesson)

    repaired_def = validated.chapters[0].scenes[0].visual.mermaid_definition
    assert repaired_def is not None
    assert repaired_def.startswith("graph LR")


def test_quality_validator_enforces_caption_monotonicity() -> None:
    scene_captions = Scene(
        scene_id="sc-caps",
        title="Subtitles",
        narration_text="Testing subtitles timing monotonicity.",
        visual=VisualSpec(scene_type=SceneType.TEXT, highlighted_terms=[]),
        captions=[
            Caption(offset_ms=2000, duration_ms=1000, text="First slice"),
            Caption(offset_ms=1500, duration_ms=200, text="Second slice"),  # Out of order & too short
        ],
    )
    lesson = create_minimal_lesson(scenes=[scene_captions])
    validated = validate_and_sanitize_lesson_quality(lesson)

    caps = validated.chapters[0].scenes[0].captions
    assert caps[0].offset_ms == 2000
    assert caps[1].offset_ms >= 2000
    assert caps[1].duration_ms >= 500


def test_quality_validator_raises_error_on_empty_chapters() -> None:
    lesson = create_minimal_lesson()
    lesson.chapters = []

    with pytest.raises(LessonQualityError, match="at least one chapter"):
        validate_and_sanitize_lesson_quality(lesson)

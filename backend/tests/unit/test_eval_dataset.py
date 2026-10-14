"""Evaluation dataset tests verifying prompt construction, safety constraints, and grounding."""

from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.models.common import GroundingCategory, UncertaintyLevel
from app.models.lesson import Chapter, Lesson, Scene, VisualSpec
from app.services.quality_validator import (
    EXECUTION_CLAIM_PATTERNS,
    is_incomplete_input,
    validate_and_sanitize_lesson_quality,
)
from tests.eval_dataset.cases import EVALUATION_DATASET

PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "app" / "prompts"
jinja_env = Environment(loader=FileSystemLoader(PROMPTS_DIR), autoescape=False)


def test_eval_dataset_has_all_required_categories() -> None:
    """Ensure dataset covers Python, JS/React, SQL, Git, Diff, Incomplete, Hindi, Hinglish."""
    case_ids = {case.id for case in EVALUATION_DATASET}
    required_ids = {
        "python_key_error",
        "js_react_type_error",
        "sql_left_join_group_by",
        "git_merge_conflict",
        "code_diff_async",
        "incomplete_single_line_error",
        "hindi_zerodivision",
        "hinglish_promise_rejection",
    }
    assert required_ids.issubset(case_ids)


def test_all_eval_cases_render_valid_prompts() -> None:
    """Verify that every evaluation case renders into a complete Jinja2 prompt."""
    template = jinja_env.get_template("lesson_prompt.j2")

    for case in EVALUATION_DATASET:
        prompt = template.render(
            content=case.input_content,
            content_type=case.content_type.value,
            language=case.language.value,
            detail_level=case.detail_level.value,
        )

        assert prompt is not None
        assert len(prompt) > 200
        assert case.language.value in prompt
        assert "<<<USER_CONTENT_START>>>" in prompt
        assert "<<<USER_CONTENT_END>>>" in prompt
        # Verify content was cleanly delimited
        assert case.input_content in prompt
        # Verify grounding instructions are included in the prompt
        assert "grounding_category" in prompt
        assert "what_to_verify" in prompt
        assert "NEVER claim that you ran, tested, or executed" in prompt


def test_incomplete_eval_cases_are_correctly_classified() -> None:
    """Ensure incomplete cases trigger is_incomplete_input correctly."""
    for case in EVALUATION_DATASET:
        classified_incomplete = is_incomplete_input(case.input_content)
        assert classified_incomplete == case.is_incomplete, (
            f"Case {case.id} incomplete classification mismatch: expected {case.is_incomplete}"
        )


def test_prohibited_failure_modes_are_detected_and_sanitized() -> None:
    """Verify that any prohibited execution claim is caught by quality validator patterns."""
    for case in EVALUATION_DATASET:
        for prohibited in case.prohibited.prohibited_phrases:
            test_narration = f"Here is the lesson. {prohibited}. Now observe the output."
            # The pattern must detect the prohibited phrase
            detected = any(p.search(test_narration) for p in EXECUTION_CLAIM_PATTERNS)
            assert detected is True, f"Failed to detect prohibited phrase: '{prohibited}' in case {case.id}"


def test_eval_case_lesson_validation_passes_all_safety_rules() -> None:
    """Test building synthetic lessons from eval cases through the quality validator."""
    for case in EVALUATION_DATASET:
        mock_scene = Scene(
            scene_id=f"scene-{case.id}-01",
            title=case.name,
            narration_text=f"Analyzing {case.name} based on static code pattern inspection.",
            visual=VisualSpec(
                scene_type=case.content_type.value if case.content_type.value in {"code_diff", "terminal"} else "text",
                highlighted_terms=case.expected.expected_terms[:2],
            ),
            uncertainty=UncertaintyLevel.NONE,
            grounding_category=GroundingCategory.OBSERVED,
        )

        mock_lesson = Lesson(
            lesson_id=f"lesson-{case.id}",
            title=case.name,
            language=case.language,
            content_type=case.content_type,
            total_estimated_duration_ms=5000,
            chapters=[
                Chapter(
                    chapter_id=f"chap-{case.id}-01",
                    title="Analysis",
                    summary="Evaluation chapter",
                    scenes=[mock_scene],
                )
            ],
            gemini_model_version="gemini-3.8-flash",
            generated_at="2026-10-15T00:00:00Z",
        )

        validated = validate_and_sanitize_lesson_quality(
            mock_lesson, user_content=case.input_content
        )

        assert validated is not None
        assert len(validated.chapters) >= 1
        assert len(validated.chapters[0].scenes) >= 1

        first_scene = validated.chapters[0].scenes[0]
        # Incomplete cases must express uncertainty
        if case.is_incomplete:
            assert first_scene.uncertainty != UncertaintyLevel.NONE
            assert first_scene.uncertainty_note is not None
        # Actionable verification must be populated
        assert len(first_scene.what_to_verify) > 0
        assert len(validated.verification_checklist) > 0

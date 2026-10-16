"""Deterministic server-side validation and sanitization for lesson quality and trust."""

import logging
import re
import uuid
from datetime import UTC, datetime

from app.models.common import (
    GroundingCategory,
    SceneType,
    UncertaintyLevel,
    VerificationImportance,
)
from app.models.lesson import Caption, Lesson, VerificationItem

logger = logging.getLogger("decodeai.quality_validator")

# Regex to detect false claims of code execution or unverified runtime tests
EXECUTION_CLAIM_PATTERNS = [
    re.compile(r"\b(i\s+ran\s+this\s+code)\b", re.IGNORECASE),
    re.compile(r"\b(we\s+ran\s+this\s+code)\b", re.IGNORECASE),
    re.compile(r"\b(i\s+executed(\s+(this|the)\s+code)?)\b", re.IGNORECASE),
    re.compile(r"\b(we\s+executed(\s+(this|the)\s+code)?)\b", re.IGNORECASE),
    re.compile(r"\b(tested\s+on\s+our\s+(server|sandbox|environment))\b", re.IGNORECASE),
    re.compile(r"\b(tested\s+and\s+confirmed\s+in\s+python\s+runtime)\b", re.IGNORECASE),
    re.compile(r"\b(tested\s+in\s+python\s+runtime)\b", re.IGNORECASE),
    re.compile(r"\b(our\s+execution\s+confirmed)\b", re.IGNORECASE),
    re.compile(r"\b(i\s+verified\s+by\s+running)\b", re.IGNORECASE),
    re.compile(r"\b(guaranteed\s+to\s+fix\s+without\s+testing)\b", re.IGNORECASE),
    re.compile(r"\b(executed\s+query\s+against\s+database)\b", re.IGNORECASE),
    re.compile(r"\b(tested\s+on\s+postgres)\b", re.IGNORECASE),
    re.compile(r"\b(automatically\s+resolved\s+and\s+committed)\b", re.IGNORECASE),
    re.compile(r"\b(measured\s+50ms\s+latency)\b", re.IGNORECASE),
    re.compile(r"\b(the\s+database\s+is\s+definitely)\b", re.IGNORECASE),
    re.compile(r"\b(this\s+will\s+definitely\s+fix)\b", re.IGNORECASE),
]

VALID_MERMAID_PREFIXES = (
    "graph",
    "flowchart",
    "sequencediagram",
    "statediagram",
    "classdiagram",
    "erdiagram",
)


class LessonQualityError(ValueError):
    """Raised when a generated lesson fails critical structural or semantic rules."""

    pass


def sanitize_execution_claims(text: str) -> tuple[str, bool]:
    """Sanitize any false claims of server-side code execution in narration or titles.

    Args:
        text: The narration or title text.

    Returns:
        A tuple of (sanitized_text, was_modified).
    """
    modified = False
    cleaned = text
    for pattern in EXECUTION_CLAIM_PATTERNS:
        if pattern.search(cleaned):
            modified = True
            cleaned = pattern.sub("Static code analysis indicates", cleaned)
    return cleaned, modified


def is_incomplete_input(user_content: str | None) -> bool:
    """Detect whether input is likely an isolated snippet, error line, or missing context.

    Heuristics:
    - Less than 120 characters in total.
    - Single line error with no traceback or surrounding function.
    - Missing enclosing function/class definitions for isolated statements.
    """
    if not user_content or not user_content.strip():
        return True

    stripped = user_content.strip()
    if len(stripped) < 120:
        return True

    lines = [line.strip() for line in stripped.splitlines() if line.strip()]
    if len(lines) <= 2:
        # Check if it looks like an error message without stack trace
        first_line = lines[0].lower()
        if any(err in first_line for err in ("error:", "exception:", "failed", "cannot read")):
            return True

    return False


def validate_and_sanitize_lesson_quality(lesson: Lesson, user_content: str | None = None) -> Lesson:
    """Validate and sanitize a Lesson model for structural integrity, grounding, and truthfulness.

    Args:
        lesson: The generated or parsed Lesson instance.
        user_content: The original raw user content for grounding checks.

    Returns:
        The validated and normalized Lesson.

    Raises:
        LessonQualityError: If the lesson contains irrecoverable structural defects.
    """
    # 1. Structural checks on chapters
    if not lesson.chapters:
        raise LessonQualityError("Lesson must contain at least one chapter.")

    seen_chapter_ids: set[str] = set()
    seen_scene_ids: set[str] = set()
    total_scenes = 0

    input_is_partial = is_incomplete_input(user_content)

    for ch_idx, chapter in enumerate(lesson.chapters):
        if not chapter.chapter_id or chapter.chapter_id in seen_chapter_ids:
            chapter.chapter_id = f"chap-{ch_idx + 1:02d}"
        seen_chapter_ids.add(chapter.chapter_id)

        if not chapter.scenes:
            raise LessonQualityError(f"Chapter '{chapter.chapter_id}' has no scenes.")

        for sc_idx, scene in enumerate(chapter.scenes):
            total_scenes += 1
            if not scene.scene_id or scene.scene_id in seen_scene_ids:
                scene.scene_id = f"scene-{ch_idx + 1:02d}-{sc_idx + 1:02d}"
            seen_scene_ids.add(scene.scene_id)

            # 2. Sanitize false claims of code execution in narration
            sanitized_narration, modified = sanitize_execution_claims(scene.narration_text)
            if modified:
                logger.warning(
                    "Stripped false code-execution claim from scene %s narration", scene.scene_id
                )
                scene.narration_text = sanitized_narration

            sanitized_title, _ = sanitize_execution_claims(scene.title)
            scene.title = sanitized_title

            # 3. Visual mode validation and fallback
            v = scene.visual
            if v.scene_type == SceneType.CODE_DIFF:
                if not v.before_code and not v.after_code:
                    logger.info("CodeDiffScene in %s has no code; falling back to text", scene.scene_id)
                    v.scene_type = SceneType.TEXT
                elif v.before_code and v.after_code and v.before_code.strip() == v.after_code.strip():
                    if scene.uncertainty == UncertaintyLevel.NONE:
                        scene.uncertainty = UncertaintyLevel.LOW
                        scene.uncertainty_note = "Before and after code snippets are identical."

            elif v.scene_type == SceneType.TERMINAL:
                if not v.command and not v.output:
                    v.command = "python script.py"
                    v.output = "Output not captured in user input"

            elif v.scene_type == SceneType.DIAGRAM:
                if v.mermaid_definition:
                    cleaned_def = v.mermaid_definition.strip().lower()
                    if not any(cleaned_def.startswith(prefix) for prefix in VALID_MERMAID_PREFIXES):
                        v.mermaid_definition = (
                            "graph LR\n  Input[Input Content] --> Processing[Analysis Engine] --> Output[Lesson]"
                        )

            # 4. Caption timing bounds and monotonicity
            if scene.captions:
                last_offset = 0
                for c in scene.captions:
                    c.offset_ms = max(c.offset_ms, last_offset)
                    c.duration_ms = max(c.duration_ms, 500)
                    last_offset = c.offset_ms

            # 5. Grounding & Uncertainty Calibration for partial/isolated inputs
            if input_is_partial:
                # If input is incomplete, at least one scene must express uncertainty
                if scene.uncertainty == UncertaintyLevel.NONE and sc_idx == 0:
                    scene.uncertainty = UncertaintyLevel.MEDIUM
                    scene.uncertainty_note = (
                        "Input contains an isolated snippet without surrounding application context or runtime trace."
                    )
                if scene.grounding_category == GroundingCategory.OBSERVED and sc_idx > 0:
                    scene.grounding_category = GroundingCategory.INFERRED

            # 6. Ensure what_to_verify is populated with actionable items
            if not scene.what_to_verify:
                if scene.visual.scene_type == SceneType.CODE_DIFF:
                    scene.what_to_verify = [
                        "Test with empty and boundary input values locally.",
                        "Verify variable names and types against existing codebase declarations.",
                    ]
                else:
                    scene.what_to_verify = [
                        "Confirm runtime behavior in local test environment.",
                        "Inspect related module dependencies and error handling.",
                    ]

    if total_scenes == 0:
        raise LessonQualityError("Lesson contains 0 scenes.")

    # 7. Glossary integrity
    cleaned_glossary = []
    for g in lesson.glossary:
        if g.term.strip() and g.definition.strip():
            cleaned_glossary.append(g)
    lesson.glossary = cleaned_glossary

    # 8. Verification checklist integrity
    if not lesson.verification_checklist:
        lesson.verification_checklist = [
            VerificationItem(
                id="chk-01",
                statement="Verify that the proposed changes or explanation align with your project's runtime dependencies.",
                importance=VerificationImportance.MUST_KNOW,
                grounding=GroundingCategory.NEEDS_VERIFICATION,
            )
        ]
    else:
        for idx, item in enumerate(lesson.verification_checklist):
            if not item.id or not item.id.strip():
                item.id = f"chk-{idx + 1:02d}"
            # Ensure items have appropriate grounding
            if not hasattr(item, "grounding") or not item.grounding:
                item.grounding = GroundingCategory.NEEDS_VERIFICATION

    return lesson


def enrich_and_validate_lesson(
    lesson: Lesson,
    model_version: str,
    user_content: str | None = None,
) -> Lesson:
    """Enrich model output with backend-verified identifiers, timestamps, and duration calculations,
    then apply deterministic quality, structural, and grounding validation.

    Ensures identical post-processing regardless of whether generation came from
    primary (Gemini) or fallback (Groq).
    """
    # 1. Lesson ID normalization
    if (
        not lesson.lesson_id
        or lesson.lesson_id.startswith("string")
        or lesson.lesson_id in ("lesson-123", "lesson-id")
    ):
        lesson.lesson_id = f"lesson-ai-{uuid.uuid4().hex[:8]}"

    # 2. Metadata
    lesson.gemini_model_version = model_version
    lesson.generated_at = datetime.now(UTC).isoformat()

    # 3. Ensure valid captions and calculate total duration
    total_duration = 0
    for chapter in lesson.chapters:
        for scene in chapter.scenes:
            if not scene.captions:
                scene.captions = [
                    Caption(
                        offset_ms=0,
                        duration_ms=5000,
                        text=scene.narration_text.strip() or scene.title,
                    )
                ]
            scene_duration = max(
                sum(c.duration_ms for c in scene.captions),
                max(c.offset_ms + c.duration_ms for c in scene.captions),
                4000,
            )
            total_duration += scene_duration

    lesson.total_estimated_duration_ms = total_duration

    # 4. Deterministic quality and evidence grounding validation
    return validate_and_sanitize_lesson_quality(lesson, user_content=user_content)

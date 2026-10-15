"""Pydantic schemas defining the complete Lesson structure."""

from typing import Any

from pydantic import BaseModel, Field, PrivateAttr, field_validator

from app.models.common import (
    AnimationStyle,
    ContentType,
    GroundingCategory,
    Language,
    SceneType,
    UncertaintyLevel,
    VerificationImportance,
)


class VisualSpec(BaseModel):
    """Specification of the visual layout and animations for a scene."""

    scene_type: SceneType = Field(..., description="Visual scene mode")
    before_code: str | None = Field(default=None, description="Previous version of code for diffs")
    after_code: str | None = Field(default=None, description="Modified or new version of code")
    language: str | None = Field(
        default=None, description="Programming language identifier (e.g. python, ts)"
    )
    command: str | None = Field(default=None, description="Terminal command executed")
    output: str | None = Field(default=None, description="Terminal standard output or log")
    exit_code: int | None = Field(default=None, description="Exit code for terminal scene")
    mermaid_definition: str | None = Field(default=None, description="Mermaid.js diagram script")
    highlighted_terms: list[str] = Field(
        default_factory=list, description="Key tokens to visually emphasize"
    )
    animation_style: AnimationStyle = Field(
        default=AnimationStyle.FADE_SLIDE,
        description="Animation transition style",
    )

    @field_validator("scene_type", mode="before")
    @classmethod
    def normalize_scene_type(cls, value: Any) -> SceneType:
        if isinstance(value, SceneType):
            return value
        if isinstance(value, str):
            clean = value.lower().strip()
            if clean in {"code_diff", "diff", "code", "before_after"}:
                return SceneType.CODE_DIFF
            if clean in {"diagram", "architecture", "flowchart", "system"}:
                return SceneType.DIAGRAM
            if clean in {"terminal", "cli", "command", "console"}:
                return SceneType.TERMINAL
            if clean in {"comparison", "compare"}:
                return SceneType.COMPARISON
            if clean in {"text", "concept", "explanation"}:
                return SceneType.TEXT
        return SceneType.TEXT

    @field_validator("animation_style", mode="before")
    @classmethod
    def normalize_animation_style(cls, value: Any) -> AnimationStyle:
        if isinstance(value, AnimationStyle):
            return value
        if isinstance(value, str):
            clean = value.lower().strip()
            for style in AnimationStyle:
                if style.value == clean:
                    return style
        return AnimationStyle.FADE_SLIDE


class Caption(BaseModel):
    """Timestamped subtitle slice aligned with narration audio."""

    offset_ms: int = Field(
        default=0, ge=0, description="Start offset from beginning of scene audio in ms"
    )
    duration_ms: int = Field(default=4000, ge=100, description="Display duration of caption in ms")
    text: str = Field(..., min_length=1, description="Subtitle line text")

    @field_validator("offset_ms", mode="before")
    @classmethod
    def normalize_offset(cls, value: Any) -> int:
        try:
            return max(int(value), 0)
        except (ValueError, TypeError):
            return 0

    @field_validator("duration_ms", mode="before")
    @classmethod
    def normalize_duration(cls, value: Any) -> int:
        try:
            return max(int(value), 500)
        except (ValueError, TypeError):
            return 4000


class GlossaryEntry(BaseModel):
    """Definition of key technical vocabulary introduced in the lesson."""

    term: str = Field(..., min_length=1, description="Technical concept or term")
    definition: str = Field(..., min_length=1, description="Clear, contextual definition")
    example: str | None = Field(default=None, description="Illustrative usage example")


class VerificationItem(BaseModel):
    """Checklist item to help the developer verify correctness or identify caveats."""

    id: str = Field(..., min_length=1, description="Unique identifier for checklist item")
    statement: str = Field(..., min_length=1, description="Verification condition or check")
    importance: VerificationImportance = Field(
        default=VerificationImportance.MUST_KNOW, description="Criticality level"
    )
    grounding: GroundingCategory = Field(
        default=GroundingCategory.NEEDS_VERIFICATION,
        description="Grounding level for this verification check",
    )

    @field_validator("importance", mode="before")
    @classmethod
    def normalize_importance(cls, value: Any) -> VerificationImportance:
        if isinstance(value, VerificationImportance):
            return value
        if isinstance(value, str):
            clean = value.lower().strip()
            if clean in {"must-know", "must_know", "critical", "high"}:
                return VerificationImportance.MUST_KNOW
            if clean in {"caution", "warning", "medium"}:
                return VerificationImportance.CAUTION
            if clean in {"nice-to-know", "nice_to_know", "low", "optional"}:
                return VerificationImportance.NICE_TO_KNOW
        return VerificationImportance.MUST_KNOW

    @field_validator("grounding", mode="before")
    @classmethod
    def normalize_grounding(cls, value: Any) -> GroundingCategory:
        if isinstance(value, GroundingCategory):
            return value
        if isinstance(value, str):
            clean = value.lower().strip().replace("-", "_")
            if clean in {"observed", "fact", "direct"}:
                return GroundingCategory.OBSERVED
            if clean in {"inferred", "inference", "deduction", "hypothesis"}:
                return GroundingCategory.INFERRED
            if clean in {"needs_verification", "verify", "unverified", "action"}:
                return GroundingCategory.NEEDS_VERIFICATION
        return GroundingCategory.NEEDS_VERIFICATION


class Scene(BaseModel):
    """Single discrete step or screen in an educational chapter."""

    scene_id: str = Field(..., min_length=1, description="Unique scene identifier")
    title: str = Field(..., min_length=1, description="Short scene heading")
    narration_text: str = Field(..., min_length=1, description="Spoken voiceover script")
    visual: VisualSpec = Field(..., description="Visual layout and content payload")
    captions: list[Caption] = Field(default_factory=list, description="Word/phrase caption timings")
    uncertainty: UncertaintyLevel = Field(
        default=UncertaintyLevel.NONE,
        description="Flagged ambiguity or confidence level",
    )
    uncertainty_note: str | None = Field(
        default=None,
        description="Explanation when uncertainty is low/medium/high",
    )
    grounding_category: GroundingCategory = Field(
        default=GroundingCategory.OBSERVED,
        description="Whether this scene presents observed facts, inferred causes, or items needing verification",
    )
    what_to_verify: list[str] = Field(
        default_factory=list,
        description="Concrete, actionable verification steps for the developer",
    )

    @field_validator("uncertainty", mode="before")
    @classmethod
    def normalize_uncertainty(cls, value: Any) -> UncertaintyLevel:
        if isinstance(value, UncertaintyLevel):
            return value
        if isinstance(value, str):
            clean = value.lower().strip()
            for level in UncertaintyLevel:
                if level.value == clean:
                    return level
        return UncertaintyLevel.NONE

    @field_validator("grounding_category", mode="before")
    @classmethod
    def normalize_scene_grounding(cls, value: Any) -> GroundingCategory:
        if isinstance(value, GroundingCategory):
            return value
        if isinstance(value, str):
            clean = value.lower().strip().replace("-", "_")
            if clean in {"observed", "fact", "direct", "syntax"}:
                return GroundingCategory.OBSERVED
            if clean in {"inferred", "inference", "deduction", "cause", "hypothesis"}:
                return GroundingCategory.INFERRED
            if clean in {"needs_verification", "verify", "unverified", "caveat", "action"}:
                return GroundingCategory.NEEDS_VERIFICATION
        return GroundingCategory.OBSERVED


class Chapter(BaseModel):
    """Section of the lesson grouping related scenes around a theme."""

    chapter_id: str = Field(..., min_length=1, description="Unique chapter identifier")
    title: str = Field(..., min_length=1, description="Chapter title")
    summary: str = Field(..., min_length=1, description="High level synopsis of this chapter")
    scenes: list[Scene] = Field(..., min_length=1, description="Sequential list of scenes")


class Lesson(BaseModel):
    """Top-level generated lesson object returned by the DecodeAI backend."""

    lesson_id: str = Field(..., min_length=1, description="Unique lesson identifier")
    title: str = Field(..., min_length=1, description="Overall lesson headline")
    language: Language = Field(..., description="Narration language")
    content_type: ContentType = Field(..., description="Input category")
    total_estimated_duration_ms: int = Field(
        ..., ge=0, description="Total run time across all scenes"
    )
    chapters: list[Chapter] = Field(..., min_length=1, description="List of chapters")
    glossary: list[GlossaryEntry] = Field(default_factory=list, description="Key terms glossary")
    verification_checklist: list[VerificationItem] = Field(
        default_factory=list,
        description="Items the engineer should verify",
    )
    gemini_model_version: str = Field(
        ..., description="Model version used to synthesize the lesson"
    )
    generated_at: str = Field(..., description="ISO 8601 UTC timestamp of creation")

    _timing_metrics: dict[str, float] = PrivateAttr(default_factory=dict)

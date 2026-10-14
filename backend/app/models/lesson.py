"""Pydantic schemas defining the complete Lesson structure."""

from pydantic import BaseModel, Field
from app.models.common import (
    AnimationStyle,
    ContentType,
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
    language: str | None = Field(default=None, description="Programming language identifier (e.g. python, ts)")
    command: str | None = Field(default=None, description="Terminal command executed")
    output: str | None = Field(default=None, description="Terminal standard output or log")
    exit_code: int | None = Field(default=None, description="Exit code for terminal scene")
    mermaid_definition: str | None = Field(default=None, description="Mermaid.js diagram script")
    highlighted_terms: list[str] = Field(default_factory=list, description="Key tokens to visually emphasize")
    animation_style: AnimationStyle = Field(
        default=AnimationStyle.FADE_SLIDE,
        description="Animation transition style",
    )


class Caption(BaseModel):
    """Timestamped subtitle slice aligned with narration audio."""

    offset_ms: int = Field(..., ge=0, description="Start offset from beginning of scene audio in ms")
    duration_ms: int = Field(..., gt=0, description="Display duration of caption in ms")
    text: str = Field(..., min_length=1, description="Subtitle line text")


class GlossaryEntry(BaseModel):
    """Definition of key technical vocabulary introduced in the lesson."""

    term: str = Field(..., min_length=1, description="Technical concept or term")
    definition: str = Field(..., min_length=1, description="Clear, contextual definition")
    example: str | None = Field(default=None, description="Illustrative usage example")


class VerificationItem(BaseModel):
    """Checklist item to help the developer verify correctness or identify caveats."""

    id: str = Field(..., min_length=1, description="Unique identifier for checklist item")
    statement: str = Field(..., min_length=1, description="Verification condition or check")
    importance: VerificationImportance = Field(..., description="Criticality level")


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
    total_estimated_duration_ms: int = Field(..., ge=0, description="Total run time across all scenes")
    chapters: list[Chapter] = Field(..., min_length=1, description="List of chapters")
    glossary: list[GlossaryEntry] = Field(default_factory=list, description="Key terms glossary")
    verification_checklist: list[VerificationItem] = Field(
        default_factory=list,
        description="Items the engineer should verify",
    )
    gemini_model_version: str = Field(..., description="Model version used to synthesize the lesson")
    generated_at: str = Field(..., description="ISO 8601 UTC timestamp of creation")

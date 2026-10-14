"""Common enumerations and types used across DecodeAI backend."""

from enum import StrEnum


class Language(StrEnum):
    """Supported narration and explanation languages."""

    EN = "en"
    HI = "hi"
    HINGLISH = "hinglish"


class ContentType(StrEnum):
    """Classification of the input content to be explained."""

    PROMPT = "prompt"
    CODE_DIFF = "code_diff"
    TERMINAL = "terminal"
    COMPLETION = "completion"
    EXPLANATION = "explanation"


class SceneType(StrEnum):
    """Visual presentation mode for an individual lesson scene."""

    TEXT = "text"
    CODE_DIFF = "code_diff"
    TERMINAL = "terminal"
    DIAGRAM = "diagram"
    COMPARISON = "comparison"


class UncertaintyLevel(StrEnum):
    """Confidence or ambiguity assessment for an explanation element."""

    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DetailLevel(StrEnum):
    """Depth of breakdown requested by the user."""

    BRIEF = "brief"
    STANDARD = "standard"
    DEEP = "deep"


class VerificationImportance(StrEnum):
    """Criticality level of a checklist verification item."""

    MUST_KNOW = "must-know"
    NICE_TO_KNOW = "nice-to-know"
    CAUTION = "caution"


class AnimationStyle(StrEnum):
    """Transition and entrance effect applied to the scene visual."""

    FADE_SLIDE = "fade-slide"
    TYPEWRITER = "typewriter"
    HIGHLIGHT_SWEEP = "highlight-sweep"

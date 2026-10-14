"""Common enumerations and types used across DecodeAI backend."""

from enum import Enum


class Language(str, Enum):
    """Supported narration and explanation languages."""
    EN = "en"
    HI = "hi"
    HINGLISH = "hinglish"


class ContentType(str, Enum):
    """Classification of the input content to be explained."""
    PROMPT = "prompt"
    CODE_DIFF = "code_diff"
    TERMINAL = "terminal"
    COMPLETION = "completion"
    EXPLANATION = "explanation"


class SceneType(str, Enum):
    """Visual presentation mode for an individual lesson scene."""
    TEXT = "text"
    CODE_DIFF = "code_diff"
    TERMINAL = "terminal"
    DIAGRAM = "diagram"
    COMPARISON = "comparison"


class UncertaintyLevel(str, Enum):
    """Confidence or ambiguity assessment for an explanation element."""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DetailLevel(str, Enum):
    """Depth of breakdown requested by the user."""
    BRIEF = "brief"
    STANDARD = "standard"
    DEEP = "deep"


class VerificationImportance(str, Enum):
    """Criticality level of a checklist verification item."""
    MUST_KNOW = "must-know"
    NICE_TO_KNOW = "nice-to-know"
    CAUTION = "caution"


class AnimationStyle(str, Enum):
    """Transition and entrance effect applied to the scene visual."""
    FADE_SLIDE = "fade-slide"
    TYPEWRITER = "typewriter"
    HIGHLIGHT_SWEEP = "highlight-sweep"

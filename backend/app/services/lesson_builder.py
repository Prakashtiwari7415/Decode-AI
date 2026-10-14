"""Service for building structured lessons and fixtures."""

from datetime import datetime, timezone
from app.models.common import (
    AnimationStyle,
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
from app.models.request import LessonRequest
from app.utils.language import estimate_duration_ms


class LessonBuilder:
    """Orchestrates lesson generation from prompts or provides deterministic fixtures."""

    def build_fixture(self, request: LessonRequest) -> Lesson:
        """Construct a complete, valid Lesson fixture tailored to the requested language.
        
        The fixture consists of:
        - 1 Chapter
        - 2 Scenes (one `text` scene and one `code_diff` scene)
        - 2 Glossary entries
        - 2 Verification checklist items

        Args:
            request: The LessonRequest specifying language, detail level, and content type.

        Returns:
            A populated, valid Lesson Pydantic model.
        """
        lang = request.language

        if lang == Language.HI:
            lesson_title = "पायथन लिस्ट कॉम्प्रिहेंशन को समझें"
            chap_title = "मूल बातें और सिंटैक्स रूपांतरण"
            chap_summary = "इस अध्याय में हम पारंपरिक लूप्स को आधुनिक लिस्ट कॉम्प्रिहेंशन में बदलना सीखेंगे।"
            scene1_title = "लिस्ट कॉम्प्रिहेंशन क्या है?"
            scene1_narration = "लिस्ट कॉम्प्रिहेंशन पायथन में मौजूदा लिस्ट या इटरेबल से नई लिस्ट बनाने का एक संक्षिप्त और सुंदर तरीका है।"
            scene2_title = "लूप से कॉम्प्रिहेंशन में परिवर्तन"
            scene2_narration = "यहाँ हम देख सकते हैं कि कैसे तीन लाइन के फॉर-लूप को एक ही पठनीय लाइन में संक्षिप्त किया जा सकता है।"
            glossary = [
                GlossaryEntry(
                    term="लिस्ट कॉम्प्रिहेंशन (List Comprehension)",
                    definition="पायथन में आइटम्स को फिल्टर और ट्रांसफॉर्म करके नई लिस्ट बनाने का संक्षिप्त सिंटैक्स।",
                    example="[x * 2 for x in items if x > 0]",
                ),
                GlossaryEntry(
                    term="सिंटैक्टिक शुगर (Syntactic Sugar)",
                    definition="प्रोग्रामिंग भाषा में ऐसा सिंटैक्स जो कोड को लिखना और पढ़ना अधिक सरल बनाता है।",
                    example="x += 1 पारंपरिक x = x + 1 का सिंटैक्टिक शुगर है।",
                ),
            ]
            verification = [
                VerificationItem(
                    id="chk-001",
                    statement="सुनिश्चित करें कि इटरेबल खाली होने पर भी कॉम्प्रिहेंशन सुरक्षित रूप से खाली लिस्ट लौटाता है।",
                    importance=VerificationImportance.MUST_KNOW,
                ),
                VerificationItem(
                    id="chk-002",
                    statement="यदि लॉजिक में एक से अधिक नेस्टेड लूप्स हों, तो साधारण लूप्स अधिक पठनीय हो सकते हैं।",
                    importance=VerificationImportance.CAUTION,
                ),
            ]
        elif lang == Language.HINGLISH:
            lesson_title = "Python List Comprehensions Seekhein"
            chap_title = "Basics aur Syntax Transformation"
            chap_summary = "Iss chapter mein hum regular for-loop ko concise list comprehension mein convert karna seekhenge."
            scene1_title = "List Comprehension kya hota hai?"
            scene1_narration = "List comprehension Python mein ek concise aur expressive tareeqa hai nayi list create karne ka."
            scene2_title = "Loop se Comprehension mein conversion"
            scene2_narration = "Dekhiye kaise 3 lines ka code ek single readable line mein convert ho jaata hai bina kisi complexity ke."
            glossary = [
                GlossaryEntry(
                    term="List Comprehension",
                    definition="Python ka short syntax jisse existing list se nayi list transform ki jaati hai.",
                    example="[num ** 2 for num in numbers]",
                ),
                GlossaryEntry(
                    term="Syntactic Sugar",
                    definition="Syntax jo program ke features ko humans ke liye likhna aur samajhna aasan banata hai.",
                    example="x += 1 instead of x = x + 1",
                ),
            ]
            verification = [
                VerificationItem(
                    id="chk-001",
                    statement="Confirm karein ki empty list par iteration bina runtime error ke empty list return kare.",
                    importance=VerificationImportance.MUST_KNOW,
                ),
                VerificationItem(
                    id="chk-002",
                    statement="Heavy nested loops mein list comprehension readability ko affect kar sakti hai.",
                    importance=VerificationImportance.CAUTION,
                ),
            ]
        else:  # Default to English
            lesson_title = "Understanding Python List Comprehensions"
            chap_title = "Fundamentals & Syntax Transformation"
            chap_summary = "Learn how to transform traditional verbose loops into clean and idiomatic list comprehensions."
            scene1_title = "What is a List Comprehension?"
            scene1_narration = "A list comprehension provides a concise and elegant syntax for creating lists based on existing iterables."
            scene2_title = "Transforming Loops into Comprehensions"
            scene2_narration = "Notice how three lines of procedural loop code condense into a single declarative expression."
            glossary = [
                GlossaryEntry(
                    term="List Comprehension",
                    definition="A concise syntax to transform and filter elements of an iterable into a new list.",
                    example="[x * 2 for x in items if x > 0]",
                ),
                GlossaryEntry(
                    term="Syntactic Sugar",
                    definition="Syntax within a programming language designed to make things easier to read or express.",
                    example="Using x += 1 instead of x = x + 1",
                ),
            ]
            verification = [
                VerificationItem(
                    id="chk-001",
                    statement="Confirm the comprehension constructs a new list object without mutating the source iterable.",
                    importance=VerificationImportance.MUST_KNOW,
                ),
                VerificationItem(
                    id="chk-002",
                    statement="For multi-nested loops or complex conditionals, a standard for-loop may offer superior readability.",
                    importance=VerificationImportance.CAUTION,
                ),
            ]

        # Calculate estimated durations
        scene1_duration = max(estimate_duration_ms(scene1_narration, lang), 4000)
        scene2_duration = max(estimate_duration_ms(scene2_narration, lang), 5000)

        scene1 = Scene(
            scene_id="scene-01-intro",
            title=scene1_title,
            narration_text=scene1_narration,
            visual=VisualSpec(
                scene_type=SceneType.TEXT,
                highlighted_terms=["list comprehension", "syntax", "iterable"],
                animation_style=AnimationStyle.FADE_SLIDE,
            ),
            captions=[
                Caption(offset_ms=0, duration_ms=scene1_duration, text=scene1_narration)
            ],
            uncertainty=UncertaintyLevel.NONE,
            uncertainty_note=None,
        )

        scene2 = Scene(
            scene_id="scene-02-diff",
            title=scene2_title,
            narration_text=scene2_narration,
            visual=VisualSpec(
                scene_type=SceneType.CODE_DIFF,
                before_code="result = []\nfor x in items:\n    result.append(x * 2)",
                after_code="result = [x * 2 for x in items]",
                language="python",
                highlighted_terms=["append", "for", "in"],
                animation_style=AnimationStyle.HIGHLIGHT_SWEEP,
            ),
            captions=[
                Caption(offset_ms=0, duration_ms=scene2_duration, text=scene2_narration)
            ],
            uncertainty=UncertaintyLevel.NONE,
            uncertainty_note=None,
        )

        chapter = Chapter(
            chapter_id="chap-01-transformation",
            title=chap_title,
            summary=chap_summary,
            scenes=[scene1, scene2],
        )

        total_duration = scene1_duration + scene2_duration

        return Lesson(
            lesson_id="lesson-fixture-001",
            title=lesson_title,
            language=lang,
            content_type=request.content_type,
            total_estimated_duration_ms=total_duration,
            chapters=[chapter],
            glossary=glossary,
            verification_checklist=verification,
            gemini_model_version="gemini-2.5-flash",
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    def build(self, request: LessonRequest) -> Lesson:
        """Generate a lesson based on request parameters.
        
        Milestone 1 uses build_fixture() to return a deterministic, complete Lesson.
        Milestone 2 will route this to GeminiClient for dynamic generation.

        Args:
            request: The validated lesson request payload.

        Returns:
            Constructed Lesson model.
        """
        return self.build_fixture(request)

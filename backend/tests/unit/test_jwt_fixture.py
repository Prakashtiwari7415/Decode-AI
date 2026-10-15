"""Regression tests verifying JWT topic consistency and prevention of Python fixture bleed."""

from app.models.common import ContentType, DetailLevel, Language, SceneType
from app.models.request import LessonRequest
from app.services.lesson_builder import LessonBuilder


def test_jwt_fixture_has_jwt_content_and_zero_python_leakage() -> None:
    """Verify JWT request produces pure JWT scenes with zero Python list comprehension leakage."""
    builder = LessonBuilder()
    request = LessonRequest(
        content="Explain how JSON Web Tokens work and how the signature is verified.",
        content_type=ContentType.EXPLANATION,
        language=Language.EN,
        detail_level=DetailLevel.STANDARD,
        use_fixture=True,
    )

    lesson = builder.build_fixture(request)

    assert lesson.lesson_id == "lesson-fixture-jwt"
    assert "JWT" in lesson.title or "JSON Web Token" in lesson.title
    assert len(lesson.chapters) == 2

    # Check all scene titles, narrations, and visual specs
    all_scenes = [sc for ch in lesson.chapters for sc in ch.scenes]
    assert len(all_scenes) == 4

    # Verify scene types present
    scene_types = [sc.visual.scene_type for sc in all_scenes]
    assert SceneType.TEXT in scene_types
    assert SceneType.CODE_DIFF in scene_types
    assert SceneType.DIAGRAM in scene_types
    assert SceneType.TERMINAL in scene_types

    # Aggregate all textual content across chapters, scenes, captions, glossary, checklist
    text_corpus = []
    text_corpus.append(lesson.title)
    for ch in lesson.chapters:
        text_corpus.append(ch.title)
        text_corpus.append(ch.summary)
        for sc in ch.scenes:
            text_corpus.append(sc.title)
            text_corpus.append(sc.narration_text)
            for cap in sc.captions:
                text_corpus.append(cap.text)
            if sc.visual.before_code:
                text_corpus.append(sc.visual.before_code)
            if sc.visual.after_code:
                text_corpus.append(sc.visual.after_code)
            if sc.visual.command:
                text_corpus.append(sc.visual.command)
            if sc.visual.output:
                text_corpus.append(sc.visual.output)
            if sc.visual.mermaid_definition:
                text_corpus.append(sc.visual.mermaid_definition)
            text_corpus.extend(sc.visual.highlighted_terms)

    for g in lesson.glossary:
        text_corpus.append(g.term)
        text_corpus.append(g.definition)
        if g.example:
            text_corpus.append(g.example)

    for v in lesson.verification_checklist:
        text_corpus.append(v.statement)

    full_text = " ".join(text_corpus).lower()

    # Affirmative JWT terms must be present
    assert "jwt" in full_text
    assert "token" in full_text
    assert "signature" in full_text
    assert "header" in full_text
    assert "payload" in full_text

    # Prohibited Python list-comprehension terms must NEVER appear
    forbidden_python_terms = [
        "list comprehension",
        ".append()",
        "loop.append",
        "items=range",
        "list_append",
        "cpython",
        "for x in",
        "bytecode engine",
        "35% faster",
    ]
    for forbidden in forbidden_python_terms:
        assert forbidden not in full_text, f"Forbidden Python term '{forbidden}' leaked into JWT lesson"


def test_multilingual_jwt_fixtures() -> None:
    """Verify Hindi and Hinglish JWT fixtures are coherent and topic-focused."""
    builder = LessonBuilder()

    # Hindi
    req_hi = LessonRequest(
        content="JWT प्रमाणीकरण कैसे काम करता है?",
        content_type=ContentType.EXPLANATION,
        language=Language.HI,
        detail_level=DetailLevel.STANDARD,
        use_fixture=True,
    )
    lesson_hi = builder.build_fixture(req_hi)
    assert lesson_hi.lesson_id == "lesson-fixture-jwt"
    assert "JWT" in lesson_hi.title
    assert "टोकन" in lesson_hi.chapters[0].title or "टोकन" in lesson_hi.chapters[0].summary

    # Hinglish
    req_hinglish = LessonRequest(
        content="JWT auth flow and token verification samjhao",
        content_type=ContentType.EXPLANATION,
        language=Language.HINGLISH,
        detail_level=DetailLevel.STANDARD,
        use_fixture=True,
    )
    lesson_hinglish = builder.build_fixture(req_hinglish)
    assert lesson_hinglish.lesson_id == "lesson-fixture-jwt"
    assert "JWT" in lesson_hinglish.title
    assert "Token" in lesson_hinglish.chapters[0].title


def test_repeated_switching_between_topics_causes_no_bleed() -> None:
    """Verify alternating between Python and JWT fixtures remains completely isolated."""
    builder = LessonBuilder()

    jwt_req = LessonRequest(
        content="Explain JWT bearer tokens and claims",
        content_type=ContentType.EXPLANATION,
        language=Language.EN,
        detail_level=DetailLevel.STANDARD,
        use_fixture=True,
    )
    py_req = LessonRequest(
        content="def loop(items):\n    return [x * 2 for x in items]",
        content_type=ContentType.EXPLANATION,
        language=Language.EN,
        detail_level=DetailLevel.STANDARD,
        use_fixture=True,
    )

    # 1. Fetch JWT
    res1 = builder.build_fixture(jwt_req)
    assert res1.lesson_id == "lesson-fixture-jwt"
    assert "jwt" in res1.title.lower()

    # 2. Fetch Python
    res2 = builder.build_fixture(py_req)
    assert res2.lesson_id == "lesson-fixture-001"
    assert "comprehension" in res2.title.lower()

    # 3. Fetch JWT again
    res3 = builder.build_fixture(jwt_req)
    assert res3.lesson_id == "lesson-fixture-jwt"
    assert "jwt" in res3.title.lower()

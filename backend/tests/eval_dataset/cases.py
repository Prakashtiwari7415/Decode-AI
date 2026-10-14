"""Version-controlled evaluation dataset for DecodeAI technical accuracy, grounding, and trust."""

from dataclasses import dataclass, field

from app.models.common import (
    ContentType,
    DetailLevel,
    GroundingCategory,
    Language,
    UncertaintyLevel,
)


@dataclass(frozen=True)
class EvalExpectedProperties:
    """Expected structural and semantic properties for an evaluation case."""

    min_scenes: int = 1
    expected_terms: list[str] = field(default_factory=list)
    expected_grounding_levels: list[GroundingCategory] = field(default_factory=list)
    min_uncertainty: UncertaintyLevel = UncertaintyLevel.NONE
    required_checklist_patterns: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class EvalProhibitedFailureModes:
    """Disallowed failure modes that must trigger a test failure."""

    prohibited_phrases: list[str] = field(
        default_factory=lambda: [
            "i ran this code",
            "we ran this code",
            "i executed",
            "we executed",
            "tested on our server",
            "tested in python runtime",
            "our execution confirmed",
            "i verified by running",
        ]
    )
    prohibit_zero_uncertainty: bool = False
    prohibited_scene_types: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class EvalCase:
    """Single evaluation case specifying input content, parameters, and trust criteria."""

    id: str
    name: str
    content_type: ContentType
    language: Language
    detail_level: DetailLevel
    input_content: str
    is_incomplete: bool
    expected: EvalExpectedProperties
    prohibited: EvalProhibitedFailureModes


EVALUATION_DATASET: list[EvalCase] = [
    # 1. Python exception
    EvalCase(
        id="python_key_error",
        name="Python KeyError in dictionary lookup",
        content_type=ContentType.TERMINAL,
        language=Language.EN,
        detail_level=DetailLevel.STANDARD,
        input_content="""Traceback (most recent call last):
  File "checkout.py", line 42, in process_order
    user_id = payload["user_id"]
KeyError: 'user_id'""",
        is_incomplete=False,
        expected=EvalExpectedProperties(
            min_scenes=1,
            expected_terms=["KeyError", "user_id", "payload"],
            expected_grounding_levels=[GroundingCategory.OBSERVED, GroundingCategory.INFERRED],
            required_checklist_patterns=["user_id", "dict", "get"],
        ),
        prohibited=EvalProhibitedFailureModes(
            prohibited_phrases=[
                "i ran this code",
                "we ran this code",
                "tested on our server",
                "our execution confirmed",
            ]
        ),
    ),
    # 2. JavaScript / React runtime error
    EvalCase(
        id="js_react_type_error",
        name="React undefined map TypeError",
        content_type=ContentType.TERMINAL,
        language=Language.EN,
        detail_level=DetailLevel.STANDARD,
        input_content="""TypeError: Cannot read properties of undefined (reading 'map')
    at UserList (UserList.tsx:14:22)
    at renderWithHooks (react-dom.development.js:15486:18)""",
        is_incomplete=False,
        expected=EvalExpectedProperties(
            min_scenes=1,
            expected_terms=["TypeError", "map", "undefined", "UserList"],
            expected_grounding_levels=[GroundingCategory.OBSERVED, GroundingCategory.INFERRED],
            required_checklist_patterns=["initial", "array", "null"],
        ),
        prohibited=EvalProhibitedFailureModes(),
    ),
    # 3. SQL query explanation
    EvalCase(
        id="sql_left_join_group_by",
        name="SQL Left Join with Group By and Having",
        content_type=ContentType.EXPLANATION,
        language=Language.EN,
        detail_level=DetailLevel.STANDARD,
        input_content="""SELECT d.name, COUNT(e.id) AS emp_count
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id
GROUP BY d.name
HAVING COUNT(e.id) > 5
ORDER BY emp_count DESC;""",
        is_incomplete=False,
        expected=EvalExpectedProperties(
            min_scenes=1,
            expected_terms=["departments", "employees", "LEFT JOIN", "GROUP BY", "HAVING"],
            expected_grounding_levels=[GroundingCategory.OBSERVED],
            required_checklist_patterns=["index", "NULL", "join"],
        ),
        prohibited=EvalProhibitedFailureModes(
            prohibited_phrases=[
                "i ran this code",
                "executed query against database",
                "tested on postgres",
            ]
        ),
    ),
    # 4. Git merge conflict
    EvalCase(
        id="git_merge_conflict",
        name="Git merge conflict in configuration file",
        content_type=ContentType.CODE_DIFF,
        language=Language.EN,
        detail_level=DetailLevel.STANDARD,
        input_content="""<<<<<<< HEAD
const API_BASE = "https://api.v2.decodeai.com";
=======
const API_BASE = process.env.VITE_API_URL || "https://api.decodeai.com";
>>>>>>> feature/env-config""",
        is_incomplete=False,
        expected=EvalExpectedProperties(
            min_scenes=1,
            expected_terms=["HEAD", "conflict", "API_BASE", "feature/env-config"],
            expected_grounding_levels=[GroundingCategory.OBSERVED, GroundingCategory.NEEDS_VERIFICATION],
            required_checklist_patterns=["merge", "conflict", "env"],
        ),
        prohibited=EvalProhibitedFailureModes(
            prohibited_phrases=[
                "i ran this code",
                "automatically resolved and committed",
            ]
        ),
    ),
    # 5. Code diff (synchronous loop to async httpx)
    EvalCase(
        id="code_diff_async",
        name="Synchronous loop converted to async gather",
        content_type=ContentType.CODE_DIFF,
        language=Language.EN,
        detail_level=DetailLevel.STANDARD,
        input_content="""# Before
def fetch_all(urls):
    results = []
    for u in urls:
        results.append(requests.get(u).json())
    return results

# After
async def fetch_all(urls):
    async with httpx.AsyncClient() as client:
        tasks = [client.get(u) for u in urls]
        responses = await asyncio.gather(*tasks)
        return [r.json() for r in responses]""",
        is_incomplete=False,
        expected=EvalExpectedProperties(
            min_scenes=1,
            expected_terms=["async", "gather", "httpx", "requests"],
            expected_grounding_levels=[GroundingCategory.OBSERVED, GroundingCategory.INFERRED],
            required_checklist_patterns=["rate limit", "connection", "error"],
        ),
        prohibited=EvalProhibitedFailureModes(
            prohibited_phrases=[
                "i ran this code",
                "tested in python runtime",
                "measured 50ms latency",
            ]
        ),
    ),
    # 6. Incomplete input (must express uncertainty)
    EvalCase(
        id="incomplete_single_line_error",
        name="Incomplete 500 Internal Server Error without context",
        content_type=ContentType.TERMINAL,
        language=Language.EN,
        detail_level=DetailLevel.BRIEF,
        input_content="HTTP 500 Internal Server Error",
        is_incomplete=True,
        expected=EvalExpectedProperties(
            min_scenes=1,
            expected_terms=["500", "Internal Server Error"],
            expected_grounding_levels=[GroundingCategory.NEEDS_VERIFICATION],
            min_uncertainty=UncertaintyLevel.MEDIUM,
            required_checklist_patterns=["server log", "traceback", "status"],
        ),
        prohibited=EvalProhibitedFailureModes(
            prohibit_zero_uncertainty=True,
            prohibited_phrases=[
                "i ran this code",
                "the database is definitely",
                "this will definitely fix",
            ],
        ),
    ),
    # 7. Hindi explanation
    EvalCase(
        id="hindi_zerodivision",
        name="ZeroDivisionError in Hindi",
        content_type=ContentType.TERMINAL,
        language=Language.HI,
        detail_level=DetailLevel.STANDARD,
        input_content="""def calculate_ratio(total, count):
    return total / count

# ZeroDivisionError: division by zero at calculate_ratio (calc.py:2)""",
        is_incomplete=False,
        expected=EvalExpectedProperties(
            min_scenes=1,
            expected_terms=["ZeroDivisionError", "division by zero"],
            expected_grounding_levels=[GroundingCategory.OBSERVED],
        ),
        prohibited=EvalProhibitedFailureModes(
            prohibited_phrases=["i ran this code", "we executed"]
        ),
    ),
    # 8. Hinglish explanation
    EvalCase(
        id="hinglish_promise_rejection",
        name="Promise Rejection in Hinglish",
        content_type=ContentType.TERMINAL,
        language=Language.HINGLISH,
        detail_level=DetailLevel.STANDARD,
        input_content="""UnhandledPromiseRejection: TypeError: res.json is not a function
    at fetchUserData (api.js:8)""",
        is_incomplete=True,
        expected=EvalExpectedProperties(
            min_scenes=1,
            expected_terms=["TypeError", "json", "fetchUserData"],
            expected_grounding_levels=[GroundingCategory.OBSERVED, GroundingCategory.NEEDS_VERIFICATION],
            min_uncertainty=UncertaintyLevel.MEDIUM,
        ),
        prohibited=EvalProhibitedFailureModes(
            prohibited_phrases=["i ran this code", "we executed"]
        ),
    ),
]

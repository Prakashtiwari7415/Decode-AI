"""Lesson generation and management router."""

import time

from fastapi import APIRouter, Request, Response, status
from fastapi.responses import JSONResponse

from app.models.lesson import Lesson
from app.models.request import LessonRequest
from app.services.gemini_client import (
    GeminiError,
    GeminiModelOutputError,
    GeminiRateLimitError,
)
from app.services.groq_client import GroqError
from app.services.lesson_builder import LessonBuilder
from app.services.quality_validator import LessonQualityError
from app.utils.sanitizer import sanitize_content

router = APIRouter(tags=["Lessons"])


def rfc9457_value_error_response(request: Request, exc: ValueError) -> JSONResponse:
    """Format ValueError exceptions into RFC 9457 Problem Details JSON responses."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "type": "about:blank",
            "title": "Bad Request",
            "status": status.HTTP_400_BAD_REQUEST,
            "detail": str(exc),
            "instance": str(request.url.path),
        },
        media_type="application/problem+json",
    )


def rfc9457_gemini_error_response(request: Request, exc: GeminiError) -> JSONResponse:
    """Format Gemini provider exceptions into RFC 9457 Problem Details JSON responses."""
    headers: dict[str, str] = {}
    if isinstance(exc, GeminiRateLimitError) and exc.retry_after is not None:
        headers["Retry-After"] = str(exc.retry_after)

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "type": "https://errors.decodeai.dev/rate-limit"
            if exc.status_code == 429
            else "about:blank",
            "title": "Gemini Rate Limit" if exc.status_code == 429 else "AI Provider Error",
            "status": exc.status_code,
            "detail": exc.detail,
            "retry_after": getattr(exc, "retry_after", None),
            "instance": str(request.url.path),
        },
        headers=headers,
        media_type="application/problem+json",
    )


@router.post(
    "/lessons/generate",
    response_model=Lesson,
    summary="Generate interactive lesson from content",
    responses={
        200: {"description": "Successfully synthesized Lesson model."},
        400: {"description": "Invalid content or prohibited injection pattern (RFC 9457)."},
        401: {"description": "Missing or unauthorized Gemini API key."},
        422: {"description": "Unprocessable entity / schema validation failure."},
        429: {"description": "Gemini rate limit or quota exceeded."},
        502: {"description": "Gemini provider or upstream service error."},
        504: {"description": "Generation timeout."},
    },
)
async def generate_lesson(
    payload: LessonRequest, request: Request, response: Response
) -> Lesson | JSONResponse:
    """Accepts LessonRequest, sanitizes content, and synthesizes a structured Lesson.

    Args:
        payload: LessonRequest model containing content and presentation choices.
        request: FastAPI HTTP request context.
        response: FastAPI HTTP response context for setting Server-Timing headers.

    Returns:
        Structured Lesson instance or RFC 9457 Problem Details response on validation error.
    """
    total_start = time.perf_counter()
    try:
        # Sanitize the input content explicitly as per specification
        cleaned_content = sanitize_content(payload.content)
        payload.content = cleaned_content

        # Build and return the Lesson (invokes Gemini or returns fixture if use_fixture=True)
        builder = LessonBuilder()
        lesson = await builder.build(payload)

        # Performance Instrumentation: attach Server-Timing header
        total_dur_ms = round((time.perf_counter() - total_start) * 1000, 1)
        timings = getattr(lesson, "_timing_metrics", None) or {}
        provider = timings.get("provider", "gemini")

        if provider == "groq":
            primary_dur = timings.get("primary_dur", 0.0)
            fallback_dur = timings.get("fallback_dur", total_dur_ms)
            response.headers["Server-Timing"] = (
                f"gemini;dur={primary_dur}, groq;dur={fallback_dur}, total;dur={total_dur_ms}"
            )
        else:
            gemini_dur = timings.get("gemini", timings.get("primary_dur", total_dur_ms))
            parse_dur = timings.get("parse", 0.0)
            quality_dur = timings.get("quality", 0.0)
            response.headers["Server-Timing"] = (
                f"gemini;dur={gemini_dur}, parse;dur={parse_dur}, quality;dur={quality_dur}, total;dur={total_dur_ms}"
            )
        return lesson
    except LessonQualityError as exc:
        return rfc9457_gemini_error_response(request, GeminiModelOutputError(str(exc)))
    except ValueError as exc:
        return rfc9457_value_error_response(request, exc)
    except GeminiError as exc:
        return rfc9457_gemini_error_response(request, exc)
    except GroqError as exc:
        return rfc9457_gemini_error_response(
            request, GeminiError(detail=exc.detail, status_code=exc.status_code)
        )

"""Lesson generation and management router."""

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from app.models.lesson import Lesson
from app.models.request import LessonRequest
from app.services.lesson_builder import LessonBuilder
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


@router.post(
    "/lessons/generate",
    response_model=Lesson,
    summary="Generate interactive lesson from content",
    responses={
        200: {"description": "Successfully synthesized Lesson model."},
        400: {"description": "Invalid content or prohibited injection pattern (RFC 9457)."},
        422: {"description": "Unprocessable entity / schema validation failure."},
    },
)
async def generate_lesson(payload: LessonRequest, request: Request) -> Lesson | JSONResponse:
    """Accepts LessonRequest, sanitizes content, and synthesizes a structured Lesson.

    Args:
        payload: LessonRequest model containing content and presentation choices.
        request: FastAPI HTTP request context.

    Returns:
        Structured Lesson instance or RFC 9457 Problem Details response on validation error.
    """
    try:
        # Sanitize the input content explicitly as per specification
        cleaned_content = sanitize_content(payload.content)
        payload.content = cleaned_content

        # Build and return the Lesson (uses fixture in Milestone 1)
        builder = LessonBuilder()
        return builder.build(payload)
    except ValueError as exc:
        return rfc9457_value_error_response(request, exc)

"""FastAPI router for Text-to-Speech audio narration endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.models.audio import NarrationRequest
from app.services.gemini_client import GeminiError
from app.services.tts_client import GeminiTTSClient
from app.utils.sanitizer import sanitize_content

logger = logging.getLogger("decodeai.audio")
router = APIRouter(prefix="/audio", tags=["Audio & Narration"])


@router.post(
    "/narrate",
    summary="Generate WAV audio narration for a lesson scene",
    description="Accepts scene narration text, language, and voice choice, returning synthesized WAV audio.",
    responses={
        200: {
            "content": {"audio/wav": {}},
            "description": "Synthesized WAV audio byte stream.",
        },
        400: {"description": "Sanitization violation or invalid parameters."},
        401: {"description": "Missing or invalid Gemini API key."},
        422: {"description": "Pydantic validation failure (e.g. empty or excessive text)."},
        429: {"description": "Gemini TTS rate limit or quota exceeded."},
        502: {"description": "Upstream AI audio provider failure."},
        504: {"description": "TTS generation timed out."},
    },
)
async def generate_narration(
    payload: NarrationRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    """Generate audio narration bytes for the provided scene text."""
    try:
        sanitized_text = sanitize_content(payload.text)
    except ValueError as exc:
        logger.warning("Sanitization rejected narration text: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "type": "about:blank",
                "title": "Invalid Content",
                "status": status.HTTP_400_BAD_REQUEST,
                "detail": str(exc),
                "instance": "/api/audio/narrate",
            },
            media_type="application/problem+json",
        )

    if not sanitized_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Narration text cannot be empty or solely whitespace.",
        )

    tts_client = GeminiTTSClient(
        api_key=settings.gemini_api_key,
        model=settings.gemini_tts_model,
        timeout_seconds=settings.gemini_tts_timeout_seconds,
    )

    try:
        wav_bytes, mime_type = await tts_client.synthesize(
            text=sanitized_text,
            language=payload.language,
            voice=payload.voice,
            is_fixture=payload.is_fixture,
        )
    except GeminiError as exc:
        logger.warning("TTS error [%d]: %s", exc.status_code, exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "type": "about:blank",
                "title": "Audio Generation Error",
                "status": exc.status_code,
                "detail": exc.detail,
                "instance": "/api/audio/narrate",
            },
            media_type="application/problem+json",
        )

    return Response(
        content=wav_bytes,
        media_type=mime_type,
        headers={
            "Content-Type": mime_type,
            "Content-Length": str(len(wav_bytes)),
            "X-Narration-Voice": payload.voice,
            "X-Narration-Language": payload.language.value,
            "Cache-Control": "public, max-age=86400, immutable",
        },
    )

"""Integration tests for the /api/audio endpoints."""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.gemini_client import (
    GeminiAuthError,
    GeminiModelOutputError,
    GeminiRateLimitError,
    GeminiTimeoutError,
)
from app.services.tts_client import GeminiTTSClient

client = TestClient(app)


def test_narrate_fixture_mode_returns_200_and_wav_audio() -> None:
    """Verify POST /api/audio/narrate with is_fixture=True returns 200 with audio/wav."""
    response = client.post(
        "/api/audio/narrate",
        json={
            "text": "Notice how three lines of imperative code condense into one declarative statement.",
            "language": "en",
            "voice": "Puck",
            "is_fixture": True,
        },
    )
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "audio/wav"
    assert response.headers["X-Narration-Voice"] == "Puck"
    assert response.headers["X-Narration-Language"] == "en"
    assert response.content.startswith(b"RIFF")
    assert len(response.content) > 1000


def test_narrate_successful_generation_returns_200_and_audio() -> None:
    """Verify POST /api/audio/narrate with mock Gemini generation returns 200."""
    fake_wav = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00" + b"\x00" * 40

    with patch.object(
        GeminiTTSClient,
        "synthesize",
        new=AsyncMock(return_value=(fake_wav, "audio/wav")),
    ):
        response = client.post(
            "/api/audio/narrate",
            json={
                "text": "The developer client sends requests to the API Gateway.",
                "language": "en",
                "voice": "Kore",
                "is_fixture": False,
            },
        )
        assert response.status_code == 200
        assert response.headers["Content-Type"] == "audio/wav"
        assert response.headers["X-Narration-Voice"] == "Kore"
        assert response.content == fake_wav


def test_narrate_empty_text_returns_422() -> None:
    """Verify POST /api/audio/narrate rejects empty text with 422."""
    response = client.post(
        "/api/audio/narrate",
        json={
            "text": "",
            "language": "en",
            "voice": "Puck",
        },
    )
    assert response.status_code == 422


def test_narrate_oversized_text_returns_422() -> None:
    """Verify POST /api/audio/narrate rejects text exceeding 2500 characters with 422."""
    response = client.post(
        "/api/audio/narrate",
        json={
            "text": "a" * 2501,
            "language": "en",
            "voice": "Puck",
        },
    )
    assert response.status_code == 422


def test_narrate_script_injection_returns_400() -> None:
    """Verify POST /api/audio/narrate rejects script injection patterns with 400."""
    response = client.post(
        "/api/audio/narrate",
        json={
            "text": "<script>alert('xss')</script> Narration text",
            "language": "en",
            "voice": "Puck",
        },
    )
    assert response.status_code == 400
    assert response.headers["Content-Type"] == "application/problem+json"


def test_narrate_missing_api_key_returns_401() -> None:
    """Verify POST /api/audio/narrate returns 401 when GeminiAuthError is raised."""
    with patch.object(
        GeminiTTSClient,
        "synthesize",
        new=AsyncMock(
            side_effect=GeminiAuthError("Gemini API key is missing or set to placeholder.")
        ),
    ):
        response = client.post(
            "/api/audio/narrate",
            json={
                "text": "Some text to narrate",
                "language": "en",
                "voice": "Puck",
                "is_fixture": False,
            },
        )
        assert response.status_code == 401
        assert response.headers["Content-Type"] == "application/problem+json"
        body = response.json()
        assert body["status"] == 401
        assert "Gemini API key is missing" in body["detail"]


def test_narrate_rate_limit_returns_429() -> None:
    """Verify POST /api/audio/narrate returns 429 with Retry-After when quota is exhausted."""
    with patch.object(
        GeminiTTSClient,
        "synthesize",
        new=AsyncMock(side_effect=GeminiRateLimitError("TTS rate limit reached.", retry_after=12)),
    ):
        response = client.post(
            "/api/audio/narrate",
            json={
                "text": "Text under rate limit",
                "language": "en",
                "voice": "Puck",
                "is_fixture": False,
            },
        )
        assert response.status_code == 429
        assert response.headers["Content-Type"] == "application/problem+json"
        assert response.headers["Retry-After"] == "12"
        data = response.json()
        assert data["status"] == 429
        assert data["retry_after"] == 12
        assert data["title"] == "Gemini TTS Rate Limit"


def test_narrate_timeout_returns_504() -> None:
    """Verify POST /api/audio/narrate returns 504 when generation times out."""
    with patch.object(
        GeminiTTSClient,
        "synthesize",
        new=AsyncMock(side_effect=GeminiTimeoutError("TTS timeout")),
    ):
        response = client.post(
            "/api/audio/narrate",
            json={
                "text": "Text that times out",
                "language": "en",
                "voice": "Puck",
                "is_fixture": False,
            },
        )
        assert response.status_code == 504
        assert response.headers["Content-Type"] == "application/problem+json"


def test_narrate_model_output_error_returns_502() -> None:
    """Verify POST /api/audio/narrate returns 502 when audio model output fails."""
    with patch.object(
        GeminiTTSClient,
        "synthesize",
        new=AsyncMock(side_effect=GeminiModelOutputError("No audio data returned by provider")),
    ):
        response = client.post(
            "/api/audio/narrate",
            json={
                "text": "Text with invalid audio",
                "language": "en",
                "voice": "Puck",
                "is_fixture": False,
            },
        )
        assert response.status_code == 502
        assert response.headers["Content-Type"] == "application/problem+json"

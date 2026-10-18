"""Integration tests for DecodeAI API endpoints."""

import os
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

# Ensure GEMINI_API_KEY is configured for test runner
os.environ["GEMINI_API_KEY"] = "dev-placeholder-key-for-tests"

from app.main import app  # noqa: E402
from app.models.lesson import Lesson  # noqa: E402
from app.services.gemini_client import (  # noqa: E402
    GeminiAuthError,
    GeminiRateLimitError,
    GeminiTimeoutError,
)
from app.services.groq_client import GroqClient, GroqError  # noqa: E402

client = TestClient(app)

MOCK_GENERATED_LESSON = {
    "lesson_id": "lesson-ai-generated-test",
    "title": "Generated AI Lesson",
    "language": "en",
    "content_type": "explanation",
    "total_estimated_duration_ms": 15000,
    "chapters": [
        {
            "chapter_id": "chap-01",
            "title": "Chapter 1",
            "summary": "Summary",
            "scenes": [
                {
                    "scene_id": "sc-01",
                    "title": "Scene 1",
                    "narration_text": "Narration text",
                    "visual": {
                        "scene_type": "text",
                        "highlighted_terms": ["AI"],
                        "animation_style": "fade-slide",
                    },
                    "captions": [{"offset_ms": 0, "duration_ms": 5000, "text": "Narration text"}],
                    "uncertainty": "none",
                }
            ],
        }
    ],
    "glossary": [{"term": "AI", "definition": "Artificial Intelligence"}],
    "verification_checklist": [
        {"id": "chk-01", "statement": "Verify logic", "importance": "must-know"}
    ],
    "gemini_model_version": "gemini-3.8-flash",
    "generated_at": "2026-10-15T00:00:00Z",
}


def test_health_check_returns_ok() -> None:
    """Verify GET /api/health, /health, and / return HTTP 200 and status ok."""
    for path in ("/api/health", "/health"):
        response = client.get(path)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == "0.1.0"
        assert "environment" in data

    root_res = client.get("/")
    assert root_res.status_code == 200
    root_data = root_res.json()
    assert root_data["status"] == "ok"
    assert "service" in root_data


def test_generate_lesson_fixture_returns_complete_lesson() -> None:
    """Verify POST /api/lessons/generate with use_fixture=True returns HTTP 200 and full fixture."""
    payload = {
        "content": "def fibonacci(n: int) -> int:\n    return n if n <= 1 else fibonacci(n - 1) + fibonacci(n - 2)",
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
        "use_fixture": True,
    }
    response = client.post("/api/lessons/generate", json=payload)
    assert response.status_code == 200
    assert "Server-Timing" in response.headers
    assert "total;dur=" in response.headers["Server-Timing"]

    data = response.json()
    assert "lesson_id" in data
    assert data["lesson_id"] == "lesson-fixture-001"
    assert "title" in data
    assert data["language"] == "en"
    assert len(data.get("chapters", [])) >= 1
    assert len(data["chapters"][0]["scenes"]) == 2
    assert len(data.get("glossary", [])) == 2
    assert len(data.get("verification_checklist", [])) == 2


def test_generate_lesson_ai_generation_success() -> None:
    """Verify POST /api/lessons/generate with mocked Gemini generation returns 200."""
    payload = {
        "content": "def binary_search(arr, x): pass",
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
        "use_fixture": False,
    }

    mock_lesson = Lesson.model_validate(MOCK_GENERATED_LESSON)

    with patch(
        "app.services.gemini_client.GeminiClient.generate_lesson",
        new_callable=AsyncMock,
        return_value=mock_lesson,
    ):
        response = client.post("/api/lessons/generate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["lesson_id"] == "lesson-ai-generated-test"
        assert data["title"] == "Generated AI Lesson"


def test_generate_lesson_missing_key_returns_401() -> None:
    """Verify live generation without valid API key returns 401."""
    payload = {
        "content": "def binary_search(arr, x): pass",
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
        "use_fixture": False,
    }

    with patch(
        "app.services.gemini_client.GeminiClient.generate_lesson",
        new_callable=AsyncMock,
        side_effect=GeminiAuthError("Missing or invalid key"),
    ):
        response = client.post("/api/lessons/generate", json=payload)
        assert response.status_code == 401
        data = response.json()
        assert data["status"] == 401
        assert "Missing or invalid key" in data["detail"]


def test_generate_lesson_rate_limit_returns_429() -> None:
    """Verify provider rate limit error returns RFC 9457 429 when fallback is unavailable."""
    payload = {
        "content": "def binary_search(arr, x): pass",
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
        "use_fixture": False,
    }

    with patch(
        "app.services.gemini_client.GeminiClient.generate_lesson",
        new_callable=AsyncMock,
        side_effect=GeminiRateLimitError("Rate limit exceeded"),
    ), patch.object(GroqClient, "is_configured", return_value=False):
        response = client.post("/api/lessons/generate", json=payload)
        assert response.status_code == 429
        data = response.json()
        assert data["status"] == 429


def test_generate_lesson_gemini_429_groq_fallback_succeeds() -> None:
    """Verify Gemini 429 triggers Groq fallback and returns 200 with Server-Timing."""
    payload = {
        "content": "def binary_search(arr, x): pass",
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
        "use_fixture": False,
    }

    mock_groq_lesson = Lesson.model_validate(MOCK_GENERATED_LESSON)
    mock_groq_lesson.gemini_model_version = "groq/openai/gpt-oss-120b"

    with patch(
        "app.services.gemini_client.GeminiClient.generate_lesson",
        new_callable=AsyncMock,
        side_effect=GeminiRateLimitError("Rate limit exceeded"),
    ), patch(
        "app.services.groq_client.GroqClient.generate_lesson",
        new_callable=AsyncMock,
        return_value=mock_groq_lesson,
    ), patch.object(GroqClient, "is_configured", return_value=True):
        response = client.post("/api/lessons/generate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["gemini_model_version"] == "groq/openai/gpt-oss-120b"
        assert "Server-Timing" in response.headers
        assert "groq;dur=" in response.headers["Server-Timing"]


def test_generate_lesson_both_providers_fail_returns_502() -> None:
    """Verify when both Gemini and Groq fail, safe 502 error is returned."""
    payload = {
        "content": "def binary_search(arr, x): pass",
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
        "use_fixture": False,
    }

    with patch(
        "app.services.gemini_client.GeminiClient.generate_lesson",
        new_callable=AsyncMock,
        side_effect=GeminiRateLimitError("Gemini 429"),
    ), patch(
        "app.services.groq_client.GroqClient.generate_lesson",
        new_callable=AsyncMock,
        side_effect=GroqError("Groq 500"),
    ), patch.object(GroqClient, "is_configured", return_value=True):
        response = client.post("/api/lessons/generate", json=payload)
        assert response.status_code == 502
        data = response.json()
        assert data["status"] == 502
        assert "Both primary and fallback" in data["detail"]


def test_generate_lesson_timeout_returns_504() -> None:
    """Verify provider timeout error returns RFC 9457 504 when fallback is unavailable."""
    payload = {
        "content": "def binary_search(arr, x): pass",
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
        "use_fixture": False,
    }

    with patch(
        "app.services.gemini_client.GeminiClient.generate_lesson",
        new_callable=AsyncMock,
        side_effect=GeminiTimeoutError("Request timed out"),
    ), patch.object(GroqClient, "is_configured", return_value=False):
        response = client.post("/api/lessons/generate", json=payload)
        assert response.status_code == 504
        data = response.json()
        assert data["status"] == 504


def test_generate_lesson_short_content_returns_422() -> None:
    """Verify POST /api/lessons/generate with content length < 10 returns HTTP 422."""
    payload = {
        "content": "short",
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
    }
    response = client.post("/api/lessons/generate", json=payload)
    assert response.status_code == 422


def test_generate_lesson_excessive_content_returns_422() -> None:
    """Verify POST /api/lessons/generate with content length > 20000 returns HTTP 422."""
    payload = {
        "content": "a" * 20_001,
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
    }
    response = client.post("/api/lessons/generate", json=payload)
    assert response.status_code == 422


def test_generate_lesson_injection_content_returns_400() -> None:
    """Verify POST /api/lessons/generate with script injection returns HTTP 400 (RFC 9457)."""
    payload = {
        "content": "<script>alert('xss attack');</script> valid length text here",
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
    }
    response = client.post("/api/lessons/generate", json=payload)
    assert response.status_code == 400

    data = response.json()
    assert data.get("status") == 400
    assert "detail" in data


def test_cors_preflight_options_for_production_frontend() -> None:
    """Verify preflight OPTIONS /api/lessons/generate allows production Render frontend."""
    headers = {
        "Origin": "https://decodeai-frontend.onrender.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,accept",
    }
    response = client.options("/api/lessons/generate", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://decodeai-frontend.onrender.com"
    assert response.headers.get("access-control-allow-credentials") == "true"
    allowed_methods = response.headers.get("access-control-allow-methods", "")
    assert "POST" in allowed_methods


def test_cors_post_request_for_production_frontend() -> None:
    """Verify POST /api/lessons/generate returns CORS headers for production frontend."""
    headers = {
        "Origin": "https://decodeai-frontend.onrender.com",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "content": "Explain how database indexing works with B-Trees",
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
        "use_fixture": True,
    }
    response = client.post("/api/lessons/generate", headers=headers, json=payload)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://decodeai-frontend.onrender.com"
    assert response.headers.get("access-control-allow-credentials") == "true"
    exposed_headers = response.headers.get("access-control-expose-headers", "")
    assert "Server-Timing" in exposed_headers


def test_cors_disallows_unauthorized_origin() -> None:
    """Verify origins not in ALLOWED_ORIGINS are rejected with 400 Disallowed CORS origin."""
    headers = {
        "Origin": "https://unauthorized-domain.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }
    response = client.options("/api/lessons/generate", headers=headers)
    assert response.status_code == 400
    assert "Disallowed CORS origin" in response.text

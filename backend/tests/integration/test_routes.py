"""Integration tests for DecodeAI API endpoints."""

import os
from fastapi.testclient import TestClient

# Ensure GEMINI_API_KEY is defined before loading the application
os.environ["GEMINI_API_KEY"] = "mock-integration-api-key"

from app.main import app  # noqa: E402

client = TestClient(app)


def test_health_check_returns_ok() -> None:
    """Verify GET /api/health returns HTTP 200 and status ok."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert "environment" in data


def test_generate_lesson_valid_returns_complete_lesson() -> None:
    """Verify POST /api/lessons/generate with valid input returns HTTP 200 and a full Lesson."""
    payload = {
        "content": "def fibonacci(n: int) -> int:\n    return n if n <= 1 else fibonacci(n - 1) + fibonacci(n - 2)",
        "content_type": "explanation",
        "language": "en",
        "detail_level": "standard",
    }
    response = client.post("/api/lessons/generate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "lesson_id" in data
    assert data["lesson_id"] == "lesson-fixture-001"
    assert "title" in data
    assert data["language"] == "en"
    assert len(data.get("chapters", [])) >= 1
    assert len(data["chapters"][0]["scenes"]) == 2
    assert len(data.get("glossary", [])) == 2
    assert len(data.get("verification_checklist", [])) == 2


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

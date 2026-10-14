"""Health check router reporting backend status and active environment."""

from typing import Any

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Service Health Check")
async def get_health() -> dict[str, Any]:
    """Return health status, current version, and environment configuration."""
    settings = get_settings()
    return {
        "status": "ok",
        "version": "0.1.0",
        "environment": settings.environment,
    }

"""API Routers for DecodeAI backend."""

from app.routers.health import router as health_router
from app.routers.lesson import router as lesson_router

__all__ = ["health_router", "lesson_router"]

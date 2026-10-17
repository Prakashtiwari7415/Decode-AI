"""Main FastAPI application entry point for DecodeAI."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers.health import router as health_router
from app.routers.lesson import router as lesson_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan context manager for startup validation and shutdown cleanup."""
    settings = get_settings()
    # Startup validation: Ensure required configurations (e.g. GEMINI_API_KEY) are valid
    settings.validate_runtime()
    yield
    # Shutdown cleanup (if any background workers or clients require graceful shutdown)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""
    app = FastAPI(
        title="DecodeAI Backend",
        description="Transform complex AI code, diffs, and prompts into structured educational lessons.",
        version="0.1.0",
        lifespan=lifespan,
    )

    settings = get_settings()

    # CORS Middleware configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routers under /api prefix and at root for deployment health checks
    app.include_router(health_router, prefix="/api")
    app.include_router(health_router)
    app.include_router(lesson_router, prefix="/api")

    # RFC 9457 Exception Handler for ValueError
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
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

    # Request Validation Exception Handler
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = exc.errors()

        # Check if validation failed due to injection security patterns
        for err in errors:
            msg = str(err.get("msg", "")).lower()
            if any(
                forbidden in msg
                for forbidden in ("prohibited pattern", "<script", "javascript:", "data:text/html")
            ):
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "type": "about:blank",
                        "title": "Bad Request",
                        "status": status.HTTP_400_BAD_REQUEST,
                        "detail": err.get("msg", "Invalid content: prohibited pattern detected"),
                        "instance": str(request.url.path),
                    },
                    media_type="application/problem+json",
                )

        # Standard 422 for schema / length validation failures
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": errors},
        )

    # Global unhandled exception handler
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        active_settings = get_settings()
        # In development, reveal exception details; in production/test, return safe message
        is_dev = active_settings.environment.lower() == "development"
        detail_msg = str(exc) if is_dev else "An internal server error occurred."

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "type": "about:blank",
                "title": "Internal Server Error",
                "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "detail": detail_msg,
                "instance": str(request.url.path),
            },
            media_type="application/problem+json",
        )

    return app


app = create_app()

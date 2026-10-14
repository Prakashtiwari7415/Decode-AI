"""Google Gemini Generative AI Client wrapper using official google-genai SDK."""

import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime

from google import genai
from google.genai import errors, types

from app.models.lesson import Caption, Lesson

logger = logging.getLogger("decodeai.gemini")


class GeminiError(Exception):
    """Base exception for Gemini client interactions."""

    def __init__(self, detail: str, status_code: int = 502) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


class GeminiAuthError(GeminiError):
    """Raised when Gemini API authentication or permissions fail."""

    def __init__(self, detail: str = "Gemini API key is invalid or unauthorized.") -> None:
        super().__init__(detail=detail, status_code=401)


class GeminiRateLimitError(GeminiError):
    """Raised when Gemini quota or rate limit is exhausted."""

    def __init__(
        self, detail: str = "Gemini API rate limit or quota exceeded. Please wait before retrying."
    ) -> None:
        super().__init__(detail=detail, status_code=429)


class GeminiTimeoutError(GeminiError):
    """Raised when generation request exceeds the configured timeout."""

    def __init__(
        self,
        detail: str = "Gemini lesson generation timed out. Please retry with a shorter prompt.",
    ) -> None:
        super().__init__(detail=detail, status_code=504)


class GeminiModelOutputError(GeminiError):
    """Raised when Gemini model output is malformed or violates the required schema."""

    def __init__(
        self, detail: str = "Gemini produced an invalid or incomplete lesson structure."
    ) -> None:
        super().__init__(detail=detail, status_code=502)


class GeminiClient:
    """Wrapper around the official google-genai SDK for structured lesson generation."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-3.8-flash",
        timeout_seconds: float = 30.0,
        fallback_models: list[str] | None = None,
    ) -> None:
        self.api_key = api_key.strip() if api_key else ""
        self.model_name = model
        self.fallback_models = fallback_models or ["gemini-2.5-flash", "gemini-3-flash-preview"]
        self.timeout_seconds = timeout_seconds

        # Instantiate google-genai Client
        if self.api_key and not self._is_placeholder(self.api_key):
            self._client: genai.Client | None = genai.Client(api_key=self.api_key)
        else:
            self._client = None

    @staticmethod
    def _is_placeholder(key: str) -> bool:
        return (
            not key
            or key.startswith("dev-placeholder")
            or "your_api_key_here" in key
            or "mock" in key.lower()
        )

    def _ensure_client(self) -> genai.Client:
        if self._is_placeholder(self.api_key) or self._client is None:
            raise GeminiAuthError(
                "Gemini API key is missing or set to placeholder. Please set a valid GEMINI_API_KEY."
            )
        return self._client

    async def generate_lesson(self, prompt: str) -> Lesson:
        """Sends prompt to Gemini with JSON schema enforcement and returns validated Lesson.

        Args:
            prompt: Rendered Jinja2 prompt containing instructions and user content.

        Returns:
            Validated, enriched Lesson instance.

        Raises:
            GeminiAuthError: Missing or invalid API key.
            GeminiRateLimitError: Quota or rate limit exceeded.
            GeminiTimeoutError: Generation exceeded timeout.
            GeminiModelOutputError: Model output failed schema validation.
            GeminiError: Other upstream provider failures.
        """
        client = self._ensure_client()

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=Lesson,
            temperature=0.2,
        )

        models_to_try = [self.model_name] + [m for m in self.fallback_models if m != self.model_name]
        response = None
        used_model = self.model_name

        for idx, candidate_model in enumerate(models_to_try):
            try:
                logger.info("Sending generation request to Gemini model: %s", candidate_model)
                async with asyncio.timeout(self.timeout_seconds):
                    response = await client.aio.models.generate_content(
                        model=candidate_model,
                        contents=prompt,
                        config=config,
                    )
                used_model = candidate_model
                break
            except TimeoutError as exc:
                logger.error(
                    "Gemini request timed out after %s seconds on model %s",
                    self.timeout_seconds,
                    candidate_model,
                )
                if idx < len(models_to_try) - 1:
                    continue
                raise GeminiTimeoutError() from exc
            except errors.APIError as exc:
                logger.error(
                    "Gemini APIError [code=%s] on model %s: %s",
                    exc.code,
                    candidate_model,
                    exc.message,
                )
                if exc.code == 503 and idx < len(models_to_try) - 1:
                    logger.warning(
                        "Model %s returned 503 high demand; falling back to %s",
                        candidate_model,
                        models_to_try[idx + 1],
                    )
                    continue
                if exc.code in (401, 403):
                    raise GeminiAuthError(
                        "Gemini API authentication failed. Verify that GEMINI_API_KEY is valid."
                    ) from exc
                if exc.code == 429:
                    raise GeminiRateLimitError(
                        "Gemini API rate limit or quota exceeded. Please retry in a few moments."
                    ) from exc
                if exc.code in (500, 502, 503, 504):
                    raise GeminiError(
                        detail="Google Gemini service is temporarily unavailable. Please retry.",
                        status_code=502,
                    ) from exc
                raise GeminiError(
                    detail=exc.message or "Gemini API error occurred.", status_code=502
                ) from exc
            except Exception as exc:
                logger.exception("Unexpected error communicating with Gemini API: %s", exc)
                raise GeminiError(
                    detail=f"Failed to communicate with AI provider: {exc}", status_code=502
                ) from exc

        if response is None:
            raise GeminiError("No response received from Gemini model.", status_code=502)

        # Extract response text
        raw_text = getattr(response, "text", None)
        if not raw_text or not raw_text.strip():
            logger.error("Gemini returned empty or null response text")
            raise GeminiModelOutputError("Model returned an empty response.")

        # Parse JSON
        try:
            parsed_data = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse Gemini response as JSON: %s", exc)
            raise GeminiModelOutputError(f"Model response was not valid JSON: {exc}") from exc

        if not isinstance(parsed_data, dict):
            raise GeminiModelOutputError(
                "Model output did not match expected JSON object structure."
            )

        # Validate with Pydantic Lesson model
        try:
            lesson = Lesson.model_validate(parsed_data)
        except Exception as exc:
            logger.error("Pydantic schema validation error on Gemini output: %s", exc)
            raise GeminiModelOutputError(f"Model output schema validation failed: {exc}") from exc

        # Enrich and normalize lesson
        return self._enrich_lesson(lesson, used_model=used_model)

    def _enrich_lesson(self, lesson: Lesson, used_model: str | None = None) -> Lesson:
        """Enrich model output with backend-verified identifiers, timestamps, and duration calculations."""
        # 1. Lesson ID
        if not lesson.lesson_id or lesson.lesson_id.startswith("string"):
            lesson.lesson_id = f"lesson-ai-{uuid.uuid4().hex[:8]}"

        # 2. Metadata
        lesson.gemini_model_version = used_model or self.model_name
        lesson.generated_at = datetime.now(UTC).isoformat()

        # 3. Ensure valid captions and calculate total duration
        total_duration = 0
        for chapter in lesson.chapters:
            for scene in chapter.scenes:
                # If model omitted captions, generate fallback caption slices from narration
                if not scene.captions:
                    scene.captions = [
                        Caption(
                            offset_ms=0,
                            duration_ms=5000,
                            text=scene.narration_text.strip() or scene.title,
                        )
                    ]
                scene_duration = max(
                    sum(c.duration_ms for c in scene.captions),
                    max(c.offset_ms + c.duration_ms for c in scene.captions),
                    4000,
                )
                total_duration += scene_duration

        lesson.total_estimated_duration_ms = total_duration
        return lesson

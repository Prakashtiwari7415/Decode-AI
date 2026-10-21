"""Groq Generative AI Client wrapper using official OpenAI Python SDK."""

import asyncio
import json
import logging
import time

from openai import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    InternalServerError,
    RateLimitError,
)

from app.models.lesson import Lesson
from app.services.quality_validator import enrich_and_validate_lesson

logger = logging.getLogger("decodeai.groq")


class GroqError(Exception):
    """Base exception for Groq client interactions."""

    def __init__(self, detail: str, status_code: int = 502) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


class GroqAuthError(GroqError):
    """Raised when Groq API authentication or permissions fail."""

    def __init__(self, detail: str = "Groq API key is invalid or unauthorized.") -> None:
        super().__init__(detail=detail, status_code=401)


class GroqRateLimitError(GroqError):
    """Raised when Groq quota or rate limit is exhausted."""

    def __init__(
        self,
        detail: str = "Groq API rate limit or quota exceeded. Please wait before retrying.",
        retry_after: int | None = None,
    ) -> None:
        super().__init__(detail=detail, status_code=429)
        self.retry_after = retry_after


class GroqTimeoutError(GroqError):
    """Raised when generation request exceeds the configured timeout."""

    def __init__(
        self,
        detail: str = "Groq lesson generation timed out.",
    ) -> None:
        super().__init__(detail=detail, status_code=504)


class GroqModelOutputError(GroqError):
    """Raised when Groq model output is malformed or violates the required schema."""

    def __init__(
        self, detail: str = "Groq produced an invalid or incomplete lesson structure."
    ) -> None:
        super().__init__(detail=detail, status_code=502)


class GroqUnavailableError(GroqError):
    """Raised when Groq service is temporarily unavailable (HTTP 503)."""

    def __init__(
        self, detail: str = "Groq service is temporarily unavailable (503). Please retry."
    ) -> None:
        super().__init__(detail=detail, status_code=503)


class GroqClient:
    """Wrapper around OpenAI SDK targeting Groq's OpenAI-compatible endpoint."""

    def __init__(
        self,
        api_key: str,
        model: str = "openai/gpt-oss-120b",
        timeout_seconds: float = 25.0,
        base_url: str = "https://api.groq.com/openai/v1",
    ) -> None:
        self.api_key = api_key.strip() if api_key else ""
        self.model_name = model
        self.timeout_seconds = timeout_seconds
        self.base_url = base_url

        if self.is_configured() and self.api_key:
            self._client: AsyncOpenAI | None = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
                timeout=self.timeout_seconds,
            )
        else:
            self._client = None

    @staticmethod
    def _is_placeholder(key: str) -> bool:
        return (
            not key
            or key.startswith("dev-placeholder")
            or "your_api_key_here" in key
            or "your_groq_api_key_here" in key
            or key.lower() == "none"
        )

    def is_configured(self) -> bool:
        """Return True if a valid non-placeholder API key is set."""
        return bool(self.api_key and not self._is_placeholder(self.api_key))

    def _ensure_client(self) -> AsyncOpenAI:
        if not self.is_configured() or self._client is None:
            raise GroqAuthError(
                "Groq API key is missing or set to placeholder. Please set a valid GROQ_API_KEY."
            )
        return self._client

    async def generate_lesson(self, prompt: str, user_content: str | None = None) -> Lesson:
        """Send prompt to Groq model with JSON mode and return validated Lesson.

        Args:
            prompt: Rendered Jinja2 prompt containing instructions and user content.
            user_content: Original raw user content for evidence grounding validation.

        Returns:
            Validated, enriched Lesson instance.

        Raises:
            GroqAuthError: Missing or invalid API key.
            GroqRateLimitError: Quota or rate limit exceeded.
            GroqTimeoutError: Generation exceeded timeout.
            GroqModelOutputError: Model output failed schema validation.
            GroqError: Other upstream provider failures.
        """
        client = self._ensure_client()
        total_start = time.perf_counter()

        logger.info("Sending generation request to Groq model: %s", self.model_name)
        api_start = time.perf_counter()
        try:
            async with asyncio.timeout(self.timeout_seconds):
                response = await client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are an expert technical educator for DecodeAI. "
                                "Transform the provided technical material into an interactive lesson. "
                                "You MUST respond with a single valid JSON object strictly conforming to the JSON schema. "
                                "Do not wrap output in markdown fences (no ```json). "
                                "Do not include any prose before or after the JSON."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    max_completion_tokens=4096,
                )
        except AuthenticationError as exc:
            logger.error("Groq authentication error: %s", exc)
            raise GroqAuthError("Groq API authentication failed. Verify GROQ_API_KEY.") from exc
        except RateLimitError as exc:
            logger.error("Groq rate limit error: %s", exc)
            raise GroqRateLimitError("Groq API rate limit or quota exceeded.") from exc
        except APITimeoutError as exc:
            logger.error("Groq API timeout after %s seconds", self.timeout_seconds)
            raise GroqTimeoutError(f"Groq request timed out after {self.timeout_seconds}s.") from exc
        except TimeoutError as exc:
            logger.error(
                "Asyncio timeout waiting for Groq response after %s seconds", self.timeout_seconds
            )
            raise GroqTimeoutError(f"Groq request timed out after {self.timeout_seconds}s.") from exc
        except InternalServerError as exc:
            logger.error("Groq internal server error: %s", exc)
            raise GroqUnavailableError("Groq service is temporarily unavailable.") from exc
        except APIConnectionError as exc:
            logger.error("Groq connection error: %s", exc)
            raise GroqTimeoutError(f"Groq connection failure: {exc}") from exc
        except APIError as exc:
            status_code = getattr(exc, "status_code", 502) or 502
            logger.error("Groq APIError [status=%s]: %s", status_code, exc)
            if status_code == 503:
                raise GroqUnavailableError() from exc
            if status_code == 429:
                raise GroqRateLimitError() from exc
            if status_code in (401, 403):
                raise GroqAuthError() from exc
            raise GroqError(detail=f"Groq provider error: {exc}", status_code=502) from exc
        except Exception as exc:
            logger.exception("Unexpected error communicating with Groq API: %s", exc)
            raise GroqError(detail=f"Failed to communicate with Groq: {exc}", status_code=502) from exc

        api_duration_ms = round((time.perf_counter() - api_start) * 1000, 1)

        # Extract content
        if not response.choices or not response.choices[0].message.content:
            logger.error("Groq returned empty response or choices")
            raise GroqModelOutputError("Groq model returned an empty response.")

        raw_text = response.choices[0].message.content.strip()

        # Parse JSON
        parse_start = time.perf_counter()
        clean_text = raw_text
        if clean_text.startswith("```"):
            lines = clean_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            clean_text = "\n".join(lines).strip()

        try:
            parsed_data = json.loads(clean_text)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse Groq response as JSON: %s", exc)
            raise GroqModelOutputError(f"Groq response was not valid JSON: {exc}") from exc

        if not isinstance(parsed_data, dict):
            raise GroqModelOutputError("Groq output did not match expected JSON object structure.")

        try:
            lesson = Lesson.model_validate(parsed_data)
        except Exception as exc:
            logger.error("Pydantic schema validation error on Groq output: %s", exc)
            raise GroqModelOutputError(f"Groq output schema validation failed: {exc}") from exc

        parse_duration_ms = round((time.perf_counter() - parse_start) * 1000, 1)

        # Quality validation & enrichment
        quality_start = time.perf_counter()
        enriched_lesson = enrich_and_validate_lesson(
            lesson=lesson,
            model_version=f"groq/{self.model_name}",
            user_content=user_content,
        )
        quality_duration_ms = round((time.perf_counter() - quality_start) * 1000, 1)
        total_duration_ms = round((time.perf_counter() - total_start) * 1000, 1)

        logger.info(
            "Groq lesson generation timing breakdown: groq_api=%.1fms, parse_validate=%.1fms, quality_validation=%.1fms, total=%.1fms",
            api_duration_ms,
            parse_duration_ms,
            quality_duration_ms,
            total_duration_ms,
        )

        enriched_lesson._timing_metrics = {
            "provider": "groq",
            "groq": api_duration_ms,
            "parse": parse_duration_ms,
            "quality": quality_duration_ms,
            "total": total_duration_ms,
        }
        return enriched_lesson

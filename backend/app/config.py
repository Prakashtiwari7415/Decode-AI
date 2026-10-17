"""Application configuration management using Pydantic Settings."""

from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """DecodeAI backend configuration settings loaded from environment or .env file."""

    gemini_api_key: str = ""
    environment: str = "development"
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    rate_limit_per_minute: int = 10
    gemini_model: str = "gemini-3.8-flash"
    gemini_timeout_seconds: float = 30.0

    # Groq Fallback Settings
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    groq_timeout_seconds: float = 25.0
    groq_base_url: str = "https://api.groq.com/openai/v1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value: Any) -> list[str]:
        """Allow origins to be provided as a list, comma-separated string, or JSON array string.

        Automatically strips leading/trailing whitespace and trailing slashes so CORS
        origin matching succeeds against browser Origin headers.
        """
        import json

        def sanitize_origin(origin: str) -> str:
            return origin.strip().rstrip("/")

        if isinstance(value, str):
            val = value.strip()
            if val.startswith("[") and val.endswith("]"):
                try:
                    parsed = json.loads(val)
                    if isinstance(parsed, list):
                        return [sanitize_origin(str(o)) for o in parsed if str(o).strip()]
                except Exception:
                    pass
            return [sanitize_origin(origin) for origin in val.split(",") if origin.strip()]
        if isinstance(value, list):
            return [sanitize_origin(str(origin)) for origin in value if str(origin).strip()]
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    def validate_runtime(self) -> None:
        """Validate startup preconditions.

        Raises:
            ValueError: If GEMINI_API_KEY is not set or empty.
        """
        is_placeholder = self.gemini_api_key.startswith("dev-placeholder")
        if not self.gemini_api_key or (not is_placeholder and not self.gemini_api_key.strip()):
            raise ValueError(
                "GEMINI_API_KEY environment variable is required and cannot be empty. "
                "Configure GEMINI_API_KEY in your hosting environment variables or backend/.env file."
            )


@lru_cache
def get_settings() -> Settings:
    """Retrieve cached singleton settings instance."""
    return Settings()

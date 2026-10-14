"""Client wrapper for Google Gemini generative AI API."""

from typing import Any
import google.generativeai as genai
from google.api_core.exceptions import GoogleAPIError


class GeminiError(Exception):
    """Custom exception raised when an interaction with Google Gemini API fails."""

    pass


class GeminiClient:
    """Wrapper client for interacting with Google Gemini models."""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash") -> None:
        """Initialize Google Gemini client with API credentials and model configuration.
        
        Args:
            api_key: Secret API key for Google Gemini.
            model: Target Gemini model name (default: gemini-2.5-flash).
        """
        self.api_key = api_key
        self.model_name = model

        # Configure google-generativeai SDK
        if self.api_key:
            genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(model_name=self.model_name)

    async def generate_lesson(self, prompt: str, response_schema: dict[str, Any]) -> dict[str, Any]:
        """Send prompt to Gemini with JSON schema enforcement and return structured dictionary.
        
        Note:
            In Milestone 1, this method is a structured stub that raises NotImplementedError.
            Full model orchestration will be implemented in Milestone 2.

        Args:
            prompt: Formatted prompt instructions.
            response_schema: Target JSON schema dictionary.

        Returns:
            Parsed dictionary matching the requested schema.

        Raises:
            GeminiError: If the Google API returns an error.
            NotImplementedError: For Milestone 1 stub invocation.
        """
        try:
            # Milestone 1 stub: Real generation will occur in Milestone 2
            raise NotImplementedError(
                "Gemini lesson generation will be implemented in Milestone 2. "
                "Use LessonBuilder.build_fixture() during Milestone 1."
            )
        except GoogleAPIError as exc:
            raise GeminiError(f"Gemini API error occurred: {exc}") from exc

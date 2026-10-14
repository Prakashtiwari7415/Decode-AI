"""Text-to-Speech (TTS) abstraction layer for DecodeAI.

Phase 2 Upgrade Path:
---------------------
In the Milestone 1 / Phase 1 MVP, audio synthesis is completely performed
on the client side via the browser's native Web Speech API (`window.speechSynthesis`).
No audio bytes are generated or streamed from the backend.

In Phase 2, this module will be expanded with `GeminiTTSClient` (or Google Cloud TTS),
implementing `synthesize(text: str, language: Language) -> bytes` to produce high-fidelity,
natural neural voices across English, Hindi, and Hinglish. The generated audio streams
will include timestamped phoneme/caption alignment data and will be cached for instant playback.
"""

from abc import ABC, abstractmethod

from app.models.common import Language


class TTSClient(ABC):
    """Abstract interface defining contract for Text-To-Speech audio synthesis."""

    @abstractmethod
    async def synthesize(self, text: str, language: Language) -> bytes:
        """Synthesize script text into raw audio bytes.

        Args:
            text: Script or narration text to synthesize.
            language: Desired voice language locale.

        Returns:
            Raw audio byte stream (e.g. MP3, WAV, or Ogg).

        Raises:
            NotImplementedError: If not implemented in the current provider.
        """
        raise NotImplementedError


class WebSpeechPassthrough(TTSClient):
    """Concrete pass-through stub for Milestone 1.

    In Milestone 1, narration playback is delegated entirely to the client's Web Speech API.
    Calls to this backend synthesizer raise NotImplementedError until Phase 2 Gemini TTS is wired.
    """

    async def synthesize(self, text: str, language: Language) -> bytes:
        """Raise NotImplementedError indicating client-side Web Speech API should be used.

        Raises:
            NotImplementedError: Always raised in Phase 1 MVP.
        """
        raise NotImplementedError(
            "Backend TTS audio synthesis is disabled for Milestone 1 MVP. "
            "Use the frontend Web Speech API for playback. Gemini TTS will be implemented in Phase 2."
        )

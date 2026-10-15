"""Text-to-Speech (TTS) service using official Google Gen AI SDK for Gemini Audio."""

import asyncio
import hashlib
import io
import logging
import math
import wave
from abc import ABC, abstractmethod

from google import genai
from google.genai import errors, types

from app.models.common import Language
from app.services.gemini_client import (
    GeminiAuthError,
    GeminiError,
    GeminiModelOutputError,
    GeminiRateLimitError,
    GeminiTimeoutError,
)

logger = logging.getLogger("decodeai.tts")

# Module-level audio cache and concurrent in-flight task deduplication
_audio_cache: dict[str, tuple[bytes, str]] = {}
_in_flight_tasks: dict[str, asyncio.Task[tuple[bytes, str]]] = {}
_in_flight_lock = asyncio.Lock()
MAX_CACHE_ENTRIES = 200


def get_tts_cache_key(text: str, language: Language, voice: str, model: str) -> str:
    """Generate a deterministic cache key based on language, voice, model, and text hash."""
    normalized = text.strip()
    h = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]
    return f"{language.value}:{voice}:{model}:{h}"


def clear_tts_cache() -> None:
    """Reset the in-memory TTS cache and in-flight tasks (useful for testing)."""
    _audio_cache.clear()
    _in_flight_tasks.clear()


def ensure_wav_format(audio_bytes: bytes, mime_type: str = "audio/wav") -> bytes:
    """Ensure audio bytes have a standard RIFF/WAV header so browsers can decode and play them.

    If the bytes are raw PCM (e.g. from Gemini audio modality), wrap them with a standard
    WAV header using sample rate parsed from mime_type or defaulting to 24000 Hz.
    """
    if (
        audio_bytes.startswith(b"RIFF")
        or audio_bytes.startswith(b"ID3")
        or audio_bytes[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")
    ):
        return audio_bytes

    sample_rate = 24000
    if "rate=" in mime_type.lower():
        try:
            sample_rate = int(mime_type.lower().split("rate=")[1].split(";")[0].strip())
        except Exception:
            sample_rate = 24000

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)  # Mono
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(audio_bytes)
    return buf.getvalue()


def generate_synthetic_wav(duration_seconds: float = 3.0, sample_rate: int = 24000) -> bytes:
    """Generate a clean synthetic WAV audio in-memory for testing and offline fixture lessons.

    Produces a brief soft audio cue followed by low ambient tone so the browser audio
    element can decode real duration and play without requiring external API credentials.
    """
    safe_duration = max(1.0, min(duration_seconds, 60.0))
    num_frames = int(safe_duration * sample_rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)

        frames = bytearray()
        for i in range(num_frames):
            t = i / sample_rate
            # Soft initial acoustic tone (440Hz fading exponentially)
            envelope = math.exp(-t * 2.5)
            sample_val = int(envelope * 2500 * math.sin(2 * math.pi * 440 * t))
            sample_val = max(-32768, min(32767, sample_val))
            frames.extend(sample_val.to_bytes(2, byteorder="little", signed=True))
        wf.writeframes(frames)
    return buf.getvalue()


class TTSClient(ABC):
    """Abstract interface defining the contract for Text-To-Speech audio synthesis."""

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        language: Language,
        voice: str = "Puck",
        is_fixture: bool = False,
    ) -> tuple[bytes, str]:
        """Synthesize script text into raw WAV audio bytes and mime type.

        Args:
            text: Script or narration text to synthesize.
            language: Desired voice language locale.
            voice: Name of the prebuilt voice.
            is_fixture: Whether to generate an offline synthetic fixture audio.

        Returns:
            Tuple of (audio_bytes, mime_type).
        """
        raise NotImplementedError


class GeminiTTSClient(TTSClient):
    """Production Gemini TTS client utilizing official google-genai SDK."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-3.8-flash-tts",
        timeout_seconds: float = 20.0,
    ) -> None:
        self.api_key = api_key.strip() if api_key else ""
        self.model_name = model
        self.timeout_seconds = timeout_seconds

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
                "Gemini API key is missing or set to placeholder. Please configure a valid GEMINI_API_KEY."
            )
        return self._client

    def _build_prompt(self, text: str, language: Language) -> str:
        """Construct narration instruction tailored to the requested language and accent."""
        if language == Language.HI:
            return (
                "Speak the following educational narration clearly, naturally, and warmly in Hindi:\n\n"
                f"{text}"
            )
        if language == Language.HINGLISH:
            return (
                "Speak the following technical narration in natural Hinglish. Pronounce technical code terms, "
                "keywords, function names, and library names distinctly in standard English, while keeping "
                "the connecting explanations and verbs in natural colloquial Hindi:\n\n"
                f"{text}"
            )
        # Default English
        return (
            "Speak the following technical lesson narration in a clear, engaging, instructional tone:\n\n"
            f"{text}"
        )

    async def _synthesize_remote(
        self,
        text: str,
        language: Language,
        voice: str,
    ) -> tuple[bytes, str]:
        """Perform the actual remote Gemini TTS API call with bounded retries on transient errors."""
        client = self._ensure_client()
        prompt = self._build_prompt(text, language)

        speech_config = types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=voice,
                )
            )
        )
        config = types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=speech_config,
            temperature=0.3,
        )

        # Single bounded attempt with retry ONLY for transient 503 errors (never retry on 429 quota)
        max_attempts = 2
        last_error: Exception | None = None

        for attempt in range(max_attempts):
            try:
                logger.info(
                    "Requesting audio narration from Gemini TTS model=%s voice=%s language=%s (len=%d, attempt=%d)",
                    self.model_name,
                    voice,
                    language.value,
                    len(text),
                    attempt + 1,
                )
                async with asyncio.timeout(self.timeout_seconds):
                    response = await client.aio.models.generate_content(
                        model=self.model_name,
                        contents=prompt,
                        config=config,
                    )
                # Successful response
                break
            except TimeoutError as exc:
                logger.error("Gemini TTS request timed out after %s seconds", self.timeout_seconds)
                raise GeminiTimeoutError("Gemini audio narration timed out. Please retry.") from exc
            except errors.APIError as exc:
                logger.error("Gemini TTS APIError [code=%s]: %s", exc.code, exc.message)
                if exc.code in (401, 403):
                    raise GeminiAuthError(
                        "Gemini API authentication failed for TTS. Verify that GEMINI_API_KEY is valid."
                    ) from exc
                if exc.code == 429:
                    # Do NOT retry on quota/rate limit error
                    retry_after = 10
                    if hasattr(exc, "response") and exc.response and hasattr(exc.response, "headers"):
                        ra = exc.response.headers.get("retry-after")
                        if ra and ra.isdigit():
                            retry_after = int(ra)
                    raise GeminiRateLimitError(
                        "Gemini TTS rate limit or quota exceeded. Please wait a moment before retrying.",
                        retry_after=retry_after,
                    ) from exc
                if exc.code == 503 and attempt < max_attempts - 1:
                    logger.warning("Gemini TTS 503 transient error; retrying once after 0.5s backoff...")
                    await asyncio.sleep(0.5)
                    last_error = exc
                    continue
                if exc.code in (500, 502, 503, 504):
                    raise GeminiError(
                        detail="Google Gemini audio service is temporarily unavailable. Please retry.",
                        status_code=502,
                    ) from exc
                raise GeminiError(
                    detail=exc.message or "Gemini TTS API error occurred.", status_code=502
                ) from exc
            except Exception as exc:
                logger.exception("Unexpected error during Gemini TTS generation: %s", exc)
                raise GeminiError(
                    detail=f"Failed to communicate with AI audio provider: {exc}", status_code=502
                ) from exc
        else:
            if last_error:
                raise GeminiError(
                    detail="Google Gemini audio service is temporarily unavailable after retry.",
                    status_code=502,
                ) from last_error

        # Extract audio payload from candidates
        candidates = getattr(response, "candidates", None) or []
        audio_data: bytes | None = None
        detected_mime = "audio/wav"

        for cand in candidates:
            content = getattr(cand, "content", None)
            parts = getattr(content, "parts", None) or []
            for part in parts:
                inline_data = getattr(part, "inline_data", None)
                if inline_data and getattr(inline_data, "data", None):
                    audio_data = inline_data.data
                    detected_mime = getattr(inline_data, "mime_type", "audio/wav") or "audio/wav"
                    break
            if audio_data:
                break

        if not audio_data or len(audio_data) == 0:
            logger.error("Gemini TTS returned no audio data in response candidate parts")
            raise GeminiModelOutputError("Gemini audio provider returned empty or null audio.")

        final_wav = ensure_wav_format(audio_data, detected_mime)
        return final_wav, "audio/wav"

    async def synthesize(
        self,
        text: str,
        language: Language,
        voice: str = "Puck",
        is_fixture: bool = False,
    ) -> tuple[bytes, str]:
        """Synthesize scene narration into browser-ready WAV audio with caching and single-flight execution.

        Args:
            text: Validated narration text.
            language: Narration language (en, hi, or hinglish).
            voice: Prebuilt voice identifier.
            is_fixture: If True, produces offline synthetic WAV audio without remote API call.

        Returns:
            Tuple of (audio_bytes, mime_type).
        """
        cache_key = get_tts_cache_key(text, language, voice, self.model_name)

        # 1. Fast path: in-memory cache hit
        if cache_key in _audio_cache:
            logger.info("TTS cache HIT for key=%s", cache_key)
            return _audio_cache[cache_key]

        # 2. Offline fixture mode
        if is_fixture or self._is_placeholder(self.api_key):
            if is_fixture:
                logger.info(
                    "Generating deterministic synthetic fixture WAV audio (text_len=%d)", len(text)
                )
                words = len(text.split())
                wpm = 110 if language == Language.HI else 125
                duration_sec = max(2.5, (words / wpm) * 60)
                wav_bytes = generate_synthetic_wav(duration_seconds=duration_sec)
                result = (wav_bytes, "audio/wav")
                _audio_cache[cache_key] = result
                return result

            # If not a fixture request but key is missing, raise auth error
            raise GeminiAuthError(
                "Gemini API key is missing or set to placeholder. Please set a valid GEMINI_API_KEY."
            )

        # 3. Single-flight execution: coalesce concurrent requests for identical key
        async with _in_flight_lock:
            # Check cache again inside lock
            if cache_key in _audio_cache:
                return _audio_cache[cache_key]

            existing_task = _in_flight_tasks.get(cache_key)
            if existing_task is None:
                task = asyncio.create_task(
                    self._synthesize_remote(text=text, language=language, voice=voice)
                )
                _in_flight_tasks[cache_key] = task
                is_creator = True
            else:
                logger.info("TTS single-flight: reusing active in-flight task for key=%s", cache_key)
                task = existing_task
                is_creator = False

        try:
            result = await task
            if is_creator:
                # Evict oldest if cache limit reached
                if len(_audio_cache) >= MAX_CACHE_ENTRIES:
                    oldest_key = next(iter(_audio_cache))
                    _audio_cache.pop(oldest_key, None)
                _audio_cache[cache_key] = result
            return result
        finally:
            if is_creator:
                async with _in_flight_lock:
                    _in_flight_tasks.pop(cache_key, None)


# Backwards compatibility alias
WebSpeechPassthrough = GeminiTTSClient

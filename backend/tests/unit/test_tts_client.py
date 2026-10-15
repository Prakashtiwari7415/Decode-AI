"""Unit tests for GeminiTTSClient, WAV formatting, and audio synthesis."""

import asyncio
import io
import wave
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from google.genai.errors import APIError

from app.models.common import Language
from app.services.gemini_client import (
    GeminiAuthError,
    GeminiModelOutputError,
    GeminiRateLimitError,
    GeminiTimeoutError,
)
from app.services.tts_client import (
    GeminiTTSClient,
    clear_tts_cache,
    ensure_wav_format,
    generate_synthetic_wav,
)


def test_ensure_wav_format_preserves_existing_wav() -> None:
    """Test that existing RIFF/WAV data is returned untouched."""
    raw_wav = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00" + b"\x00" * 20
    result = ensure_wav_format(raw_wav, "audio/wav")
    assert result == raw_wav


def test_ensure_wav_format_wraps_raw_pcm_with_valid_header() -> None:
    """Test that raw PCM data is converted into a playable WAV."""
    raw_pcm = b"\x00\x00" * 480  # 480 samples = 20ms at 24kHz
    result = ensure_wav_format(raw_pcm, "audio/pcm;rate=24000")

    assert result.startswith(b"RIFF")
    with wave.open(io.BytesIO(result), "rb") as wf:
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getframerate() == 24000
        assert wf.getnframes() == 480


def test_generate_synthetic_wav_produces_valid_audio() -> None:
    """Test offline synthetic WAV generation creates standard WAV matching duration."""
    wav_bytes = generate_synthetic_wav(duration_seconds=3.0, sample_rate=24000)
    assert wav_bytes.startswith(b"RIFF")

    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        duration = wf.getnframes() / wf.getframerate()
        assert duration == pytest.approx(3.0, abs=0.1)


@pytest.mark.asyncio
async def test_offline_fixture_synthesis_succeeds_without_api_key() -> None:
    """Test that is_fixture=True returns valid WAV audio without credentials."""
    client = GeminiTTSClient(api_key="dev-placeholder-key")
    wav_bytes, mime = await client.synthesize(
        text="A list comprehension condenses a loop into one statement.",
        language=Language.EN,
        voice="Puck",
        is_fixture=True,
    )
    assert mime == "audio/wav"
    assert wav_bytes.startswith(b"RIFF")
    assert len(wav_bytes) > 1000


@pytest.mark.asyncio
async def test_missing_or_placeholder_key_raises_auth_error_when_not_fixture() -> None:
    """Test that non-fixture synthesis raises GeminiAuthError when key is placeholder or empty."""
    client = GeminiTTSClient(api_key="dev-placeholder-key")
    with pytest.raises(GeminiAuthError) as exc_info:
        await client.synthesize(
            text="Hello world",
            language=Language.EN,
            voice="Puck",
            is_fixture=False,
        )
    assert "Gemini API key is missing" in str(exc_info.value)


@pytest.mark.asyncio
async def test_successful_gemini_tts_synthesis() -> None:
    """Test that Gemini audio generation extracts and formats WAV bytes."""
    fake_pcm = b"\x00\x00" * 1200
    mock_part = MagicMock()
    mock_part.inline_data = MagicMock()
    mock_part.inline_data.data = fake_pcm
    mock_part.inline_data.mime_type = "audio/pcm;rate=24000"

    mock_candidate = MagicMock()
    mock_candidate.content = MagicMock()
    mock_candidate.content.parts = [mock_part]

    mock_response = MagicMock()
    mock_response.candidates = [mock_candidate]

    client = GeminiTTSClient(api_key="AIzaSyValidKeyForTest123")
    assert client._client is not None

    with patch.object(
        client._client.aio.models,
        "generate_content",
        new=AsyncMock(return_value=mock_response),
    ):
        wav_bytes, mime = await client.synthesize(
            text="Look at this pipeline.",
            language=Language.EN,
            voice="Puck",
            is_fixture=False,
        )

    assert mime == "audio/wav"
    assert wav_bytes.startswith(b"RIFF")
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        assert wf.getframerate() == 24000
        assert wf.getnframes() == 1200


@pytest.mark.asyncio
async def test_empty_audio_response_raises_model_output_error() -> None:
    """Test that response with no audio parts raises GeminiModelOutputError."""
    mock_candidate = MagicMock()
    mock_candidate.content = MagicMock()
    mock_candidate.content.parts = []  # No inline_data parts

    mock_response = MagicMock()
    mock_response.candidates = [mock_candidate]

    client = GeminiTTSClient(api_key="AIzaSyValidKeyForTest123")
    assert client._client is not None

    with patch.object(
        client._client.aio.models,
        "generate_content",
        new=AsyncMock(return_value=mock_response),
    ):
        with pytest.raises(GeminiModelOutputError):
            await client.synthesize(
                text="Some text",
                language=Language.EN,
                voice="Puck",
                is_fixture=False,
            )


@pytest.mark.asyncio
async def test_tts_rate_limit_429_raises_gemini_rate_limit_error() -> None:
    """Test that HTTP 429 APIError is translated to GeminiRateLimitError."""
    client = GeminiTTSClient(api_key="AIzaSyValidKeyForTest123")
    assert client._client is not None

    mock_api_error = APIError(429, {"error": {"message": "Resource exhausted quota"}})

    with patch.object(
        client._client.aio.models,
        "generate_content",
        new=AsyncMock(side_effect=mock_api_error),
    ):
        with pytest.raises(GeminiRateLimitError):
            await client.synthesize(
                text="Rate limited text",
                language=Language.EN,
                voice="Puck",
                is_fixture=False,
            )


@pytest.mark.asyncio
async def test_tts_timeout_raises_gemini_timeout_error() -> None:
    """Test that timeout error is translated to GeminiTimeoutError."""
    client = GeminiTTSClient(api_key="AIzaSyValidKeyForTest123", timeout_seconds=0.01)
    assert client._client is not None

    async def slow_generate(*args: object, **kwargs: object) -> MagicMock:
        import asyncio

        await asyncio.sleep(0.5)
        return MagicMock()

    with patch.object(
        client._client.aio.models,
        "generate_content",
        new=AsyncMock(side_effect=slow_generate),
    ):
        with pytest.raises(GeminiTimeoutError):
            await client.synthesize(
                text="Timeout narration",
                language=Language.EN,
                voice="Puck",
                is_fixture=False,
            )


def test_prompt_construction_multilingual() -> None:
    """Test that prompt framing properly instructs Hindi, Hinglish, and English pronunciation."""
    client = GeminiTTSClient(api_key="dev-placeholder-key")

    prompt_en = client._build_prompt("Loop vs comprehension", Language.EN)
    assert "instructional tone" in prompt_en
    assert "Loop vs comprehension" in prompt_en

    prompt_hi = client._build_prompt("यहाँ लूप देखें", Language.HI)
    assert "Hindi" in prompt_hi
    assert "यहाँ लूप देखें" in prompt_hi

    prompt_hinglish = client._build_prompt("Comprehension optimize karta hai", Language.HINGLISH)
    assert "Hinglish" in prompt_hinglish
    assert "code terms" in prompt_hinglish
    assert "Comprehension optimize karta hai" in prompt_hinglish


@pytest.mark.asyncio
async def test_tts_in_memory_cache_hit_avoids_remote_call() -> None:
    """Test that subsequent synthesis of identical text/voice hits the in-memory cache."""
    clear_tts_cache()

    fake_pcm = b"\x00\x00" * 800
    mock_part = MagicMock()
    mock_part.inline_data = MagicMock()
    mock_part.inline_data.data = fake_pcm
    mock_part.inline_data.mime_type = "audio/pcm;rate=24000"

    mock_candidate = MagicMock()
    mock_candidate.content = MagicMock()
    mock_candidate.content.parts = [mock_part]

    mock_response = MagicMock()
    mock_response.candidates = [mock_candidate]

    client1 = GeminiTTSClient(api_key="AIzaSyValidKeyForTest123")
    client2 = GeminiTTSClient(api_key="AIzaSyValidKeyForTest123")

    mock_generate = AsyncMock(return_value=mock_response)

    with patch.object(client1._client.aio.models, "generate_content", new=mock_generate):
        # First call -> misses cache, executes remote API
        wav1, mime1 = await client1.synthesize(
            text="Cacheable scene text",
            language=Language.EN,
            voice="Puck",
            is_fixture=False,
        )

        # Second call on different client instance -> hits cache, generate_content NOT called again
        wav2, mime2 = await client2.synthesize(
            text="Cacheable scene text",
            language=Language.EN,
            voice="Puck",
            is_fixture=False,
        )

    assert mock_generate.call_count == 1
    assert wav1 == wav2
    assert mime1 == mime2 == "audio/wav"


@pytest.mark.asyncio
async def test_tts_concurrent_single_flight_deduplication() -> None:
    """Test that multiple concurrent requests for the same text coalesce into a single remote call."""
    clear_tts_cache()

    fake_pcm = b"\x00\x00" * 1000
    mock_part = MagicMock()
    mock_part.inline_data = MagicMock()
    mock_part.inline_data.data = fake_pcm
    mock_part.inline_data.mime_type = "audio/pcm;rate=24000"

    mock_candidate = MagicMock()
    mock_candidate.content = MagicMock()
    mock_candidate.content.parts = [mock_part]

    mock_response = MagicMock()
    mock_response.candidates = [mock_candidate]

    client = GeminiTTSClient(api_key="AIzaSyValidKeyForTest123")

    call_count = 0

    async def slow_generate(*args: object, **kwargs: object) -> MagicMock:
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.05)
        return mock_response

    with patch.object(client._client.aio.models, "generate_content", new=slow_generate):
        # Fire 3 concurrent synthesis requests for the exact same input
        results = await asyncio.gather(
            client.synthesize("Concurrent text request", Language.EN, "Kore", False),
            client.synthesize("Concurrent text request", Language.EN, "Kore", False),
            client.synthesize("Concurrent text request", Language.EN, "Kore", False),
        )

    # Exactly 1 remote call executed despite 3 concurrent requests
    assert call_count == 1
    assert len(results) == 3
    assert results[0] == results[1] == results[2]

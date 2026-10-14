"""Language utilities and speech estimation functions."""

from app.models.common import Language

# Words-Per-Minute rates tailored to pedagogical voiceover pacing
WPM_BY_LANGUAGE: dict[Language, int] = {
    Language.EN: 130,
    Language.HI: 110,
    Language.HINGLISH: 120,
}


def estimate_duration_ms(text: str, language: Language) -> int:
    """Estimate narration duration in milliseconds from word count and language WPM.
    
    Args:
        text: Narration transcript text.
        language: Language enumeration (EN=130 WPM, HI=110 WPM, HINGLISH=120 WPM).

    Returns:
        Estimated duration in milliseconds (integer).
    """
    words = [word for word in text.strip().split() if word]
    word_count = len(words)
    if word_count == 0:
        return 0

    wpm = WPM_BY_LANGUAGE.get(language, 130)
    minutes = word_count / wpm
    return int(minutes * 60 * 1000)

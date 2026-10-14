"""Input content sanitization and security filtering."""

FORBIDDEN_PATTERNS: tuple[str, ...] = (
    "<script",
    "javascript:",
    "data:text/html",
)


def sanitize_content(content: str) -> str:
    """Sanitize input content against injection attacks and malformed bytes.

    Processing steps:
    1. Removes null bytes (`\x00`).
    2. Strips leading and trailing whitespace.
    3. Rejects strings containing forbidden patterns (`<script`, `javascript:`, `data:text/html`).
    4. Returns the cleaned string.

    Args:
        content: The input string to sanitize.

    Returns:
        The sanitized content string.

    Raises:
        ValueError: If `content` is empty or contains forbidden injection patterns.
    """
    if not isinstance(content, str):
        raise ValueError("Content must be a valid string.")

    # 1. Remove null bytes
    cleaned = content.replace("\x00", "")

    # 2. Strip leading and trailing whitespace
    cleaned = cleaned.strip()

    # 3. Check for forbidden script and protocol injection patterns
    lowered = cleaned.lower()
    for forbidden in FORBIDDEN_PATTERNS:
        if forbidden in lowered:
            raise ValueError(f"Prohibited pattern detected: {forbidden}")

    return cleaned

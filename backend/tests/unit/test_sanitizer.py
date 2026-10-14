"""Unit tests for content sanitization logic."""

import pytest
from app.utils.sanitizer import sanitize_content


def test_clean_content_passes_through_unchanged_aside_from_strip() -> None:
    """Verify clean content is retained with surrounding whitespace stripped."""
    raw = "   \n\tdef compute(total: float) -> float:\n    return total * 1.18\n   "
    expected = "def compute(total: float) -> float:\n    return total * 1.18"
    assert sanitize_content(raw) == expected


def test_script_tag_raises_value_error() -> None:
    """Verify that <script tags in uppercase/lowercase trigger ValueError."""
    with pytest.raises(ValueError, match="Prohibited pattern detected: <script"):
        sanitize_content("console.log('test'); <script>alert('bad');</script>")

    with pytest.raises(ValueError, match="Prohibited pattern detected: <script"):
        sanitize_content("Something before <SCRIPT src='evil.js'></SCRIPT>")


def test_javascript_protocol_raises_value_error() -> None:
    """Verify that javascript: protocol handlers trigger ValueError."""
    with pytest.raises(ValueError, match="Prohibited pattern detected: javascript:"):
        sanitize_content("Click here: javascript:void(document.cookie)")

    with pytest.raises(ValueError, match="Prohibited pattern detected: javascript:"):
        sanitize_content("JAVASCRIPT:alert(1)")


def test_data_text_html_raises_value_error() -> None:
    """Verify that data:text/html mime URIs trigger ValueError."""
    with pytest.raises(ValueError, match="Prohibited pattern detected: data:text/html"):
        sanitize_content("Payload: data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")

    with pytest.raises(ValueError, match="Prohibited pattern detected: data:text/html"):
        sanitize_content("DATA:TEXT/HTML,<h1 onload=alert(1)>x</h1>")


def test_null_bytes_are_removed() -> None:
    """Verify that null bytes (\\x00) are stripped cleanly without corrupting the string."""
    corrupted = "const \x00secret\x00Key = \x00'abc123xyz';"
    cleaned = sanitize_content(corrupted)
    assert "\x00" not in cleaned
    assert cleaned == "const secretKey = 'abc123xyz';"

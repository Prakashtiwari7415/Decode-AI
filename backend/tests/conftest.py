"""Pytest configuration and test fixtures."""

import os

# Ensure GEMINI_API_KEY is present for all tests
os.environ.setdefault("GEMINI_API_KEY", "mock-test-gemini-api-key")
os.environ.setdefault("ENVIRONMENT", "test")

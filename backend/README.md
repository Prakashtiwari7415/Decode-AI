# DecodeAI Backend

FastAPI backend for DecodeAI, an AI-powered platform that turns
technical prompts and AI-generated coding output into easy-to-understand
multilingual lessons with visual explanations.

## Development

Install dependencies:

    uv sync

Start the development server:

    uv run uvicorn app.main:app --reload

Run tests:

    uv run pytest -v

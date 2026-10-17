.PHONY: install dev start test lint typecheck clean help

help:
	@echo "DecodeAI Backend Management Targets:"
	@echo "  install    - Install project dependencies with uv"
	@echo "  dev        - Run FastAPI development server with reload"
	@echo "  start      - Run FastAPI production server (binds to $$PORT or 8000)"
	@echo "  test       - Run unit and integration tests with pytest"
	@echo "  lint       - Check code with ruff"
	@echo "  typecheck  - Check static types with mypy"
	@echo "  clean      - Remove bytecode and cache directories"

install:
	uv sync --extra dev

dev:
	uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

start:
	uv run uvicorn app.main:app --host 0.0.0.0 --port $${PORT:-8000}

test:
	uv run pytest

lint:
	uv run ruff check .
	uv run ruff format --check .

typecheck:
	uv run mypy app/

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf dist build *.egg-info .coverage htmlcov

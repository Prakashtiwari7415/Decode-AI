.PHONY: install dev test lint typecheck clean help

help:
	@echo "DecodeAI Backend Management Targets:"
	@echo "  install    - Install project dependencies with uv"
	@echo "  dev        - Run FastAPI development server with reload"
	@echo "  test       - Run unit and integration tests with pytest"
	@echo "  lint       - Check and format code with ruff"
	@echo "  typecheck  - Check static types with mypy"
	@echo "  clean      - Remove bytecode and cache directories"

install:
	uv sync --all-extras

dev:
	uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

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

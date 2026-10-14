# DecodeAI — Understand AI Code

[![Frontend CI](https://github.com/decodeai/decodeai/actions/workflows/ci-frontend.yml/badge.svg)](https://github.com/decodeai/decodeai/actions/workflows/ci-frontend.yml)
[![Backend CI](https://github.com/decodeai/decodeai/actions/workflows/ci-backend.yml/badge.svg)](https://github.com/decodeai/decodeai/actions/workflows/ci-backend.yml)

DecodeAI transforms complex AI-generated code snippets, diffs, terminal outputs, and prompts into structured, multi-scene interactive educational lessons with animated visuals, synchronized captions, and narration scripts across English, Hindi, and Hinglish.

---

## Architecture & Milestones Overview

### Milestone 1: Monorepo Foundation & Data Contracts
- FastAPI backend with Pydantic v2 data models for chapters, scenes, visuals, captions, glossary, and verification checklists.
- React 18 + Vite + Tailwind CSS frontend with TypeScript contracts matching backend schemas.
- Input sanitization (XSS, script injection, null-byte rejection).

### Milestone 2A: YouTube-Style Animated Lesson Player
- Video viewport with play/pause, restart, chapter/scene step navigation, playback speed, and mute controls.
- Reusable animated scene renderers:
  - **Architecture Scene**: Animated client, frontend, API Gateway, bytecode engine, and memory nodes with dynamic data packet pulses.
  - **Code Diff Scene**: Side-by-side syntax-highlighted before/after diffs with copy-to-clipboard actions and line highlights.
- Timed caption overlay synchronized with scene playback duration.
- Collapsible Companion Panel with interactive Chapters list, contextual Glossary cards, and interactive Verification Checklist items.

### Milestone 2B: Real Gemini 3.8 Flash Generation Pipeline
- Integrated official Google Gen AI Python SDK (`google-genai>=1.0.0`) using `gemini-3.8-flash`.
- Native structured JSON output enforcement (`response_schema=Lesson`, `response_mime_type="application/json"`).
- Jinja2 prompt orchestration with strict delimiter safety (`<<<USER_CONTENT_START>>>`) and anti-hallucination constraints.
- Multilingual synthesis (English `en`, Hindi `hi`, and Hinglish `hinglish`).
- RFC 9457 Problem Details error handling with classified HTTP status codes:
  - `401 Unauthorized`: Missing or placeholder `GEMINI_API_KEY`.
  - `429 Too Many Requests`: Rate limit exhausted.
  - `504 Gateway Timeout`: Generation timeout.
  - `502 Bad Gateway`: Model output schema mismatch.
- Explicit Fixture Mode toggle (`use_fixture: true`) allowing offline deterministic testing without an external API key.
- Dynamic frontend feedback with 3-stage loading progress bar, 20,000 character limit enforcement, and 1-click retry.

---

## Prerequisites

Before getting started, make sure you have the following installed:

- **Node.js**: `20.x` or higher and `npm`
- **Python**: `3.12` or higher
- **uv**: Astral's fast Python package installer and resolver (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **Gemini API Key**: A valid Google Gemini API key with access to `gemini-3.8-flash` (optional for offline fixture demo mode)

---

## Quick Start (Development Mode)

### 1. Backend Setup

Navigate to the `backend` directory, configure your environment, and launch the FastAPI server:

```bash
cd backend

# Copy environment template
cp .env.example .env

# Configure your .env file
# GEMINI_API_KEY=your_actual_key_here
# GEMINI_MODEL=gemini-3.8-flash

# Install dependencies using uv
uv sync

# Run the development server (reload enabled on port 8000)
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at [http://localhost:8000](http://localhost:8000). Interactive OpenAPI documentation is accessible at [http://localhost:8000/docs](http://localhost:8000/docs).

### 2. Frontend Setup

In a new terminal window, navigate to the `frontend` directory, install packages, and start the Vite dev server:

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server with hot reload
npm run dev
```

The frontend app will be running at [http://localhost:5173](http://localhost:5173). Requests to `/api` are automatically proxied to the backend at `http://localhost:8000`.

---

## Testing & Quality Verification

### Backend Suite (25 Tests)
```bash
cd backend
uv run pytest -v           # Run full pytest suite (unit + integration)
uv run ruff check .        # Linting (0 warnings)
uv run ruff format --check # Format check
uv run mypy app            # Strict type check
```

### Frontend Suite (17 Tests)
```bash
cd frontend
npm run typecheck          # TypeScript strict validation
npm run lint               # ESLint check
npx vitest run             # Vitest test suite
npm run build              # Production bundle verification
```

---

## Running with Docker Compose (Development Only)

You can run both services concurrently with Docker Compose:

```bash
export GEMINI_API_KEY="your_api_key_here"
docker-compose up --build
```

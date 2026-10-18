# DecodeAI — Understand AI Code

Live Demo Link:https://decodeai-frontend.onrender.com/

<img width="1366" height="768" alt="image" src="https://github.com/user-attachments/assets/3b620b08-b943-499d-a80f-8a54431e0024" />


[![CI/CD Pipeline](https://github.com/decodeai/decodeai/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/decodeai/decodeai/actions/workflows/ci-cd.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

DecodeAI transforms complex AI-generated code snippets, diffs, terminal outputs, and prompts into structured, interactive slide-by-slide educational presentations with technical diagrams, before/after code diffs, synchronized captions, optional speech narration, and interactive learning checklists across English, Hindi, and Hinglish.

---

## Key Features & Architecture

- **Interactive Presentation Slideshow**: User-paced slide learning interface replacing continuous video players. Includes `Previous` / `Next` controls, direct slide-jump selector, segmented step progress bar, keyboard navigation (`←` `→`), and completion summary.
- **Scene-Level Technical Visuals**:
  - **Architecture Scene**: Interactive dataflow diagrams showing system components, API gateways, execution engines, and memory stores.
  - **Code Diff Scene**: Side-by-side syntax-highlighted code transformations with copy-to-clipboard actions and term highlights.
  - **Terminal Scene**: Formatted command executions, stdout/stderr streams, and exit code indicators.
  - **Text Concept Scene**: Structured technical explanations with categorized evidence grounding.
- **Dual AI Provider Architecture**:
  - **Primary**: Google Gemini 3.8 Flash (`gemini-3.8-flash`) with native structured JSON output schema validation.
  - **Automatic Fallback**: Groq (`openai/gpt-oss-120b`) seamlessly activates on Gemini rate limits (`429`), service unavailability (`503`), or provider timeouts (`504`).
  - **Offline Fixture Mode**: Predefined offline lessons (e.g. JSON Web Tokens, Python List Comprehensions) enable testing and demos with zero API keys or external network dependencies.
- **Evidence Grounding & Trust**: Automatic categorization of technical statements into `Observed Facts` (from user input), `Inferred Explanations`, and `Needs Verification` flags.
- **Companion Learning Sidebar**: Collapsible study panel containing interactive chapter navigation, searchable technical glossary, self-check knowledge questions, and verification checklist.
- **Optional Browser Narration**: Web Speech API (`speechSynthesis`) integration for reading slides on demand without forcing automatic slide progression.
- **Production Ready**: Stateless architecture, automated GitHub Actions CI/CD, Render Blueprint specification ([`render.yaml`](render.yaml)), RFC 9457 structured errors, and zero credentials bundled in client assets.

---

## Prerequisites

- **Node.js**: `20.x` or higher and `npm`
- **Python**: `3.12` or higher
- **uv**: Astral's fast Python package installer and resolver (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **Gemini API Key**: (Optional for local testing with offline fixtures; required for live AI lesson generation)

---

## Quick Start (Local Development)

### 1. Backend Setup

```bash
cd backend

# Copy environment template
cp .env.example .env

# Configure your .env file with your API key
# GEMINI_API_KEY=your_actual_key_here
# GROQ_API_KEY=your_groq_key_here (optional)

# Install dependencies using uv with dev extras
uv sync --extra dev

# Run FastAPI development server with hot reload on port 8000
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API Base URL: [http://localhost:8000](http://localhost:8000)
- Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- Interactive OpenAPI Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend Setup

In a new terminal window:

```bash
cd frontend

# Install dependencies reproducibly
npm install

# Start Vite dev server with hot reload on port 5173
npm run dev
```

- Frontend App: [http://localhost:5173](http://localhost:5173)
- In development, API requests to `/api` are automatically proxied to `http://localhost:8000`.

---

## Testing & Quality Verification

DecodeAI enforces strict automated quality standards across both frontend and backend test suites:

### Backend Test Suite (62 Tests)
```bash
cd backend
uv run pytest -v           # Unit & integration test suite (62 passed)
uv run ruff check .        # Fast lint check (0 errors)
uv run mypy app/           # Strict static type checking (0 errors)
```

### Frontend Test Suite (59 Tests)
```bash
cd frontend
npm run typecheck          # TypeScript compiler verification (tsc --noEmit)
npm run lint               # ESLint code style and quality check
npm run test -- --run      # Vitest test suite (59 tests passed)
npm run build              # Production bundle generation
```

---

## Production Deployment (Render & GitHub Actions)

DecodeAI is configured for zero-cost hosting on Render's free tier:
- **Frontend**: Render Static Site (HTML/JS/CSS, SPA rewrite `/* -> /index.html`).
- **Backend**: Render Web Service (FastAPI running on Python 3.12, Uvicorn on `$PORT`).
- **CI/CD**: GitHub Actions pipeline ([`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml)) runs all tests and triggers Render Deploy Hooks on pushes to `main`.

For complete deployment instructions, step-by-step setup guides, Render Blueprint IaC, and smoke-testing procedures, see:

👉 **[Complete Deployment & Operations Guide (DEPLOYMENT.md)](DEPLOYMENT.md)**

---

## Running with Docker Compose (Development Only)

To run both backend and frontend together locally in Docker:

```bash
export GEMINI_API_KEY="your_api_key_here"
docker-compose up --build
```

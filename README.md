# DecodeAI — Understand AI Code

[![Frontend CI](https://github.com/decodeai/decodeai/actions/workflows/ci-frontend.yml/badge.svg)](https://github.com/decodeai/decodeai/actions/workflows/ci-frontend.yml)
[![Backend CI](https://github.com/decodeai/decodeai/actions/workflows/ci-backend.yml/badge.svg)](https://github.com/decodeai/decodeai/actions/workflows/ci-backend.yml)

DecodeAI transforms complex AI-generated code snippets, diffs, and prompts into structured, multi-scene interactive educational lessons with automated narration and visual walkthroughs.

---

## Prerequisites

Before getting started, make sure you have the following installed:

- **Node.js**: `20.x` or higher and `npm`
- **Python**: `3.12` or higher
- **uv**: Astral's fast Python package installer and resolver (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **Gemini API Key**: A valid Google Gemini API key with access to `gemini-2.5-flash`

---

## Quick Start (Development Mode)

### 1. Backend Setup

Navigate to the `backend` directory, configure your environment, and launch the FastAPI server:

```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env and supply your GEMINI_API_KEY
# GEMINI_API_KEY=your_actual_key_here

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

## Running with Docker Compose (Development Only)

You can also run both services concurrently with Docker Compose:

```bash
export GEMINI_API_KEY="your_api_key_here"
docker-compose up --build
```

---

## Running Tests & Code Quality

### Backend
```bash
cd backend
uv run pytest              # Run unit & integration tests
uv run ruff check .        # Linting
uv run mypy app/           # Static type checking
```

### Frontend
```bash
cd frontend
npm run typecheck          # TypeScript check
npm run lint               # ESLint
npm run test -- --run      # Vitest unit tests
```
# Decode-AI

# DecodeAI — Production Deployment & CI/CD Operations Guide

This document outlines the deployment architecture, configuration, GitHub Actions CI/CD pipelines, Render free-tier setup, smoke-testing procedures, and rollback strategies for **DecodeAI**.

---

## 1. System Architecture

```mermaid
flowchart LR
    subgraph Client ["Client Browser"]
        SPA["React 18 + Vite SPA<br/>(Slideshow Engine, Tailwind, Web Speech)"]
    end

    subgraph CDN ["Render Static Site (Free Tier)"]
        Dist["Static Assets (HTML/JS/CSS)<br/>Root: frontend/dist<br/>Rewrite: /* -> /index.html"]
    end

    subgraph Backend ["Render Web Service (Free Tier)"]
        FastAPI["FastAPI Python 3.12 Backend<br/>(Uvicorn on $PORT)"]
        Health["Health Probes (/api/health, /health, /)"]
        Sanitizer["Input Sanitizer & RFC 9457"]
        Builder["Lesson Builder & Quality Validator"]
    end

    subgraph AI ["AI Model Providers"]
        Gemini["Google Gemini (Primary)<br/>gemini-3.8-flash"]
        Groq["Groq API (Automatic Fallback)<br/>openai/gpt-oss-120b"]
    end

    SPA -->|Load Bundle| Dist
    SPA -->|POST /api/lessons/generate (CORS)| FastAPI
    FastAPI --> Health
    FastAPI --> Sanitizer --> Builder
    Builder -->|1. Primary Attempt| Gemini
    Builder -.->|2. Fallback on 429/503/timeout| Groq
```

### Key Architectural Characteristics
- **Stateless Design**: DecodeAI does not require a database, persistence layer, or schema migrations. All lessons are generated on demand or served from deterministic offline fixtures.
- **Client-Side Slideshow**: User-paced slide navigation with diagrams, code diffs, terminal blocks, technical glossary, and verification checklists.
- **Provider Fallback**: Transparently fails over from Gemini to Groq for rate limits (`429`), provider unavailability (`503`), or request timeouts (`504`).
- **Separation of Concerns**: Private provider credentials (`GEMINI_API_KEY`, `GROQ_API_KEY`) reside exclusively in backend environment variables. The frontend client never handles or bundles private API keys.

---

## 2. Environment Variables

### Backend Configuration (`backend/`)
| Variable | Required? | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Yes** | `AIzaSy...` (secret) | Primary Google Gemini API key. Never exposed to browser. |
| `GEMINI_MODEL` | No | `gemini-3.8-flash` | Gemini model for structured lesson generation. |
| `GEMINI_TIMEOUT_SECONDS` | No | `30.0` | Timeout threshold before failing or triggering fallback. |
| `GROQ_API_KEY` | Recommended | `gsk_...` (secret) | Groq API key for automatic failover. |
| `GROQ_MODEL` | No | `openai/gpt-oss-120b` | High-throughput fallback model. |
| `GROQ_TIMEOUT_SECONDS` | No | `25.0` | Timeout for Groq fallback attempts. |
| `ENVIRONMENT` | **Yes** | `production` | Set to `production` to suppress internal stack traces in errors. |
| `ALLOWED_ORIGINS` | **Yes** | `https://decodeai-frontend.onrender.com,http://localhost:5173` | Comma-separated or JSON list of allowed CORS origins (without trailing slashes). |
| `RATE_LIMIT_PER_MINUTE` | No | `15` | Per-IP rate limiting applied to generation endpoints. |
| `PORT` | Auto (Render) | `10000` | Injected automatically by Render; Uvicorn binds to `0.0.0.0:$PORT`. |

### Frontend Configuration (`frontend/`)
| Variable | Required? | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | **Yes** (Prod) | `https://decodeai-backend.onrender.com` | Public base URL of the FastAPI backend. In local dev, leave empty to use Vite proxy. |

> [!IMPORTANT]
> Never place private API keys (`GEMINI_API_KEY`, `GROQ_API_KEY`) in frontend environment variables. Only public URLs belong in `VITE_*` variables.

---

## 3. Render Deployment Setup (Free Tier)

DecodeAI can be deployed on Render using either **Render Blueprints (IaC)** or **Manual Service Setup**.

### Option A: 1-Click Render Blueprint (`render.yaml`)
1. Fork or push the repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New +** > **Blueprint**.
3. Connect your repository. Render automatically reads [`render.yaml`](file:///home/neha-tiwari/Prakash's%20Folder/Decode%20AI/render.yaml) and configures both services:
   - `decodeai-backend` (Web Service)
   - `decodeai-frontend` (Static Site)
4. In the Blueprint prompt, enter your secrets:
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY` (optional, for fallback)
   - `ALLOWED_ORIGINS` (set to your frontend static site URL, e.g. `https://decodeai-frontend.onrender.com`)
   - `VITE_API_BASE_URL` (set to your backend web service URL, e.g. `https://decodeai-backend.onrender.com`)
5. Click **Apply**.

---

### Option B: Manual Render Dashboard Setup

#### 1. Backend Web Service (`decodeai-backend`)
- **Service Type**: Web Service
- **Environment**: Python
- **Root Directory**: `backend`
- **Build Command**: `pip install uv && uv sync --no-dev`
- **Start Command**: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/api/health`
- **Auto-Deploy**: Set to **No** (if using GitHub Actions CD Deploy Hooks to prevent redundant deployments).
- **Environment Variables**:
  - `ENVIRONMENT` = `production`
  - `GEMINI_API_KEY` = `<your-gemini-key>`
  - `GROQ_API_KEY` = `<your-groq-key>`
  - `ALLOWED_ORIGINS` = `https://<your-frontend-subdomain>.onrender.com`
  - `RATE_LIMIT_PER_MINUTE` = `15`
  - `GEMINI_MODEL` = `gemini-3.8-flash`
  - `GROQ_MODEL` = `openai/gpt-oss-120b`

#### 2. Frontend Static Site (`decodeai-frontend`)
- **Service Type**: Static Site
- **Root Directory**: `frontend`
- **Build Command**: `npm ci && npm run build`
- **Publish Directory**: `dist`
- **Auto-Deploy**: Set to **No** (if using GitHub Actions CD Deploy Hooks).
- **Redirects / Rewrites**:
  - Source: `/*`
  - Destination: `/index.html`
  - Action: `Rewrite`
  *(Also covered by `frontend/public/_redirects`)*
- **Environment Variables**:
  - `VITE_API_BASE_URL` = `https://<your-backend-subdomain>.onrender.com`

---

## 4. GitHub Actions CI/CD Pipeline

The pipeline is defined in [`.github/workflows/ci-cd.yml`](file:///home/neha-tiwari/Prakash's%20Folder/Decode%20AI/.github/workflows/ci-cd.yml).

```mermaid
flowchart TD
    Trigger["Push to main / Pull Request"] --> B_CI["Job 1: backend-ci<br/>• Python 3.12 + uv<br/>• Ruff lint<br/>• Mypy strict typecheck<br/>• Pytest suite (62 tests)"]
    Trigger --> F_CI["Job 2: frontend-ci<br/>• Node 20 + npm ci<br/>• TypeScript tsc --noEmit<br/>• ESLint<br/>• Vitest suite (59 tests)<br/>• Production build"]

    B_CI --> Gate{"All CI Passed &<br/>Branch == main?"}
    F_CI --> Gate

    Gate -->|Yes| CD_BE["Job 3: deploy-backend<br/>POST RENDER_BACKEND_DEPLOY_HOOK"]
    CD_BE --> CD_FE["Job 4: deploy-frontend<br/>POST RENDER_FRONTEND_DEPLOY_HOOK"]

    Gate -->|No (PR or Failure)| Halt["Done (No deployment)"]
```

### Required GitHub Repository Secrets
To enable automated deployments upon merging to `main`, configure these two repository secrets in GitHub (**Settings** > **Secrets and variables** > **Actions**):

| Secret Name | How to Obtain from Render |
| :--- | :--- |
| `RENDER_BACKEND_DEPLOY_HOOK` | Render Dashboard > `decodeai-backend` > **Settings** > **Deploy Hook** > Copy URL |
| `RENDER_FRONTEND_DEPLOY_HOOK` | Render Dashboard > `decodeai-frontend` > **Settings** > **Deploy Hook** > Copy URL |

> [!NOTE]
> If these secrets are not configured, the CI workflow runs all tests and builds successfully and posts a notice skipping webhook calls without failing.

---

## 5. Production Smoke-Test Procedure

After deploying to Render, execute this verification checklist:

### Step 1: Backend Availability & Health Probe
```bash
# Verify root status
curl -i https://<your-backend>.onrender.com/
# Expected: HTTP 200 OK, {"status":"ok","service":"DecodeAI Backend",...}

# Verify API health check
curl -i https://<your-backend>.onrender.com/api/health
# Expected: HTTP 200 OK, {"status":"ok","version":"0.1.0","environment":"production"}
```

### Step 2: Frontend Availability & SPA Routing
1. Open `https://<your-frontend>.onrender.com` in a browser.
2. Confirm the clean landing page renders with zero console errors.
3. Refresh on a sub-route (or non-root path) to confirm the SPA rewrite rule (`/* -> /index.html`) correctly serves `index.html` without 404s.

### Step 3: Frontend-to-Backend CORS Connectivity
```bash
curl -i -X OPTIONS https://<your-backend>.onrender.com/api/lessons/generate \
  -H "Origin: https://<your-frontend>.onrender.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
# Expected: HTTP 200 OK with Access-Control-Allow-Origin: https://<your-frontend>.onrender.com
```

### Step 4: Predefined Example Lessons (Offline / No API Key required)
1. On the frontend landing page, click **"Browse Predefined Example Lessons"**.
2. Select **"JSON Web Tokens"** or **"Python List Comprehensions"**.
3. Confirm the lesson loads immediately into the slideshow player without calling external LLM providers.
4. Verify slide navigation (`Previous`, `Next`, slide step progress bar, keyboard `←` `→`).

### Step 5: Live Generation & Automatic Fallback Verification
- **Standard Generation**: Paste any small code snippet (e.g. `def add(a, b): return a + b`), click **Generate Lesson**, and verify that structured slides, captions, technical glossary, and verification checklist generate within 10–20 seconds.
- **Simulated Provider Outage (Safe / Non-Destructive)**:
  In backend unit tests, provider fallback is deterministically tested without consuming real quota:
  ```bash
  cd backend && uv run pytest tests/unit/test_fallback.py
  # Verified: Gemini 429/503 -> Groq succeeds; both fail -> 502 with friendly UI recovery.
  ```

### Step 6: Mobile & Responsive Layout
1. Open browser developer tools and toggle Mobile Device mode (iPhone / Pixel).
2. Confirm slide controls stack comfortably, previous/next buttons are accessible, and the companion panel sits neatly below the viewport.

---

## 6. Known Free-Tier Limitations & Mitigations

| Limitation | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Render Web Service Inactivity Sleep** | Free-tier backend services spin down after 15 minutes of zero traffic. | Initial request after inactivity may take 30–50 seconds to cold start. DecodeAI's frontend displays an active, friendly loading indicator so users know generation is underway. |
| **No Static Inbound IP** | Free tier uses dynamic public IPs. | DNS uses standard `onrender.com` subdomains or CNAME records on custom domains. |
| **Provider Rate Limits** | Free tier Gemini / Groq keys have RPM/TPM limits. | DecodeAI automatically intercepts HTTP 429 from Gemini and transparently retries via Groq without disrupting the user session. |

---

## 7. Rollback & Troubleshooting

### Immediate Rollback
1. **Rollback via Render**: In Render Dashboard > Service > **Events**, locate the previous successful deploy and click **Rollback to this deploy**.
2. **Rollback via Git**:
   ```bash
   git revert HEAD
   git push origin main
   ```
   GitHub Actions CI/CD will test the reverted commit and trigger a fresh deploy hook.

### Common Issues
- **CORS Error (`Blocked by CORS policy`)**: Verify `ALLOWED_ORIGINS` on Render matches your frontend domain exactly without trailing slashes.
- **401 Unauthorized**: Check that `GEMINI_API_KEY` is saved correctly in Render environment variables and contains no leading/trailing whitespace.
- **API 422 Validation Error**: Content length must be between 10 and 20,000 characters and contain no `<script>` injection tags.

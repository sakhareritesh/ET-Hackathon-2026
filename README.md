# DhanGuru — AI Money Mentor for Economic Times

An AI-powered personal finance mentor that democratizes financial planning for 1.4 billion Indians. Built for the ET Hackathon 2026.

## Features

- **Money Health Score** — 6-dimension financial wellness assessment with radar chart visualization
- **FIRE Path Planner** — Monte Carlo simulation (10,000 paths) with fan chart, glide path, and goal-based SIP calculator
- **Tax Wizard** — Old vs New regime comparison, Form 16 upload, missed deductions finder, tax-saving investment ranker
- **MF Portfolio X-Ray** — CAMS/KFintech statement parsing, true XIRR, overlap heatmap, expense ratio drag analysis
- **Life Event Advisor** — AI-powered financial advice for life events (bonus, marriage, baby, job change, etc.)
- **Couples Planner** — Joint financial optimization (HRA split, 80C distribution, combined FIRE planning)
- **AI Money Mentor** — Agentic AI chat with tool-calling (calculators, analyzers) via natural language
- **Reports** — Exportable financial plans (PDF/CSV)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, Tailwind CSS v4, Recharts, Framer Motion, Zustand |
| Backend | FastAPI, Python 3.11+ |
| AI | Groq (Mixtral-8x7B) + Google Gemini 1.5 Pro (fallback) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Algorithms | Monte Carlo (scipy/numpy), Newton-Raphson XIRR, DBSCAN-style overlap, Goal-based allocation |

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Groq API key (free at groq.com) or Gemini API key

### Setup

```bash
# Clone and setup environment
cp .env.example .env
# Edit .env with your API keys

# Frontend
cd et-frontend
npm install
npm run dev

# Backend (new terminal) — must use et-backend as working directory
cd et-backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Windows:** from `et-backend`, double-click `run.bat` or run `.\run.ps1` so the server always starts in the correct folder. If you see `No module named 'app'`, you ran uvicorn from the repo root instead of `et-backend`.

**Form 16 PDF parsing** needs the backend running. In `et-frontend/.env.local` set `AI_SERVICE_URL` to the same URL (default `http://127.0.0.1:8000`). The browser calls Next.js `/api/ai/call`, which proxies to FastAPI.

### Environment Variables

```
GROQ_API_KEY=gsk_...          # Primary AI provider
GEMINI_API_KEY=...            # Fallback AI provider
AI_PROVIDER=groq              # "groq" or "gemini"
NEXT_PUBLIC_USE_LOCAL_ENGINE=true  # "false" to use backend API
```

## Architecture

```
Frontend (Next.js 16)
  ├── Landing Page (/)
  ├── Dashboard (/dashboard)
  ├── Money Profile (/money-profile) — 6-step wizard
  ├── Money Health (/money-health) — Radar chart + scoring
  ├── FIRE Planner (/fire-planner) — Monte Carlo fan chart
  ├── Tax Wizard (/tax-wizard) — Waterfall chart + Form 16
  ├── MF X-Ray (/mf-xray) — Overlap heatmap + XIRR
  ├── Life Events (/life-events) — Event-driven advice
  ├── Couples Planner (/couples-planner) — Joint optimization
  ├── Reports (/reports) — Export financial plans
  └── AI Mentor (floating chat) — Agentic tool-calling
        │
        ▼ REST API
Backend (FastAPI)
  ├── Agentic AI Pipeline (intent → tool → response)
  ├── Calculators (Tax, SIP, XIRR, Insurance, Asset Allocation)
  ├── Monte Carlo Engine (10K simulations)
  ├── Document Parsers (Form 16, CAMS/KFintech)
  └── Groq/Gemini LLM Integration
```

## Core Algorithms

1. **Monte Carlo FIRE Simulation** — 10,000 random-walk paths with normal return distribution
2. **Tax Optimization Engine** — Deterministic old vs new regime with missed deduction detection
3. **XIRR Calculator** — Newton-Raphson on XNPV equation for true portfolio returns
4. **Portfolio Overlap Analysis** — Category-based Jaccard similarity + HHI concentration
5. **Money Health Score** — Weighted 6-dimension scoring (emergency, insurance, investment, debt, tax, retirement)
6. **Agentic AI Pipeline** — Intent classification + tool routing + result formatting
7. **Goal-Based Asset Allocation** — Age-adjusted glide path with risk profile modifier

## Team

Built in 36 hours for ET Hackathon 2026.

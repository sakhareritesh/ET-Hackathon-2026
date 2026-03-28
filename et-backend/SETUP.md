# ET AI Microservice

Lightweight Python service that handles only AI generation (Gemini) and financial calculators.

## Setup

```bash
pip install -r requirements.txt
```

## Run

**Important:** the shell’s current directory must be **`et-backend`** (the folder that contains `app/`). Running `uvicorn` from the monorepo root causes `ModuleNotFoundError: No module named 'app'`.

```bash
cd et-backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

On Windows you can use **`run.bat`** or **`run.ps1`** in this folder — they `cd` here automatically.

Match `AI_SERVICE_URL` in `et-frontend/.env.local` to this URL (default `http://127.0.0.1:8000`).

## Endpoints

All endpoints are POST and stateless:

- `POST /ai/fire/plan` - FIRE plan generation
- `POST /ai/health/score` - Money health scoring
- `POST /ai/tax/analyze` - Tax analysis
- `POST /ai/tax/parse-form16` - Form 16 text → structured fields (JSON body: `{ "text": "..." }`)
- `POST /ai/events/advise` - Life event advice
- `POST /ai/mf/analyze` - MF portfolio analysis
- `GET /health` - Health check

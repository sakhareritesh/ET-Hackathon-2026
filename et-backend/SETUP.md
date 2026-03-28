# ET AI Microservice

Lightweight Python service that handles only AI generation (Gemini) and financial calculators.

## Setup

```bash
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --port 5000 --workers 1
```

## Endpoints

All endpoints are POST and stateless:

- `POST /ai/fire/plan` - FIRE plan generation
- `POST /ai/health/score` - Money health scoring
- `POST /ai/tax/analyze` - Tax analysis
- `POST /ai/events/advise` - Life event advice
- `POST /ai/mf/analyze` - MF portfolio analysis
- `GET /health` - Health check

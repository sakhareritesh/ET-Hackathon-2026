
  <h1>ET Finance Mentor</h1>
  <p><strong>AI-Powered Personal Finance Planning for India</strong></p>
  <p>From confused saver to confident investor. Get holistic, automated financial planning including FIRE tracking, mutual fund X-rays, tax wizards, and money health scoring.</p>
</div>

<br />

## Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/sakhareritesh/ET-Hackathon-2026.git
cd ET-Hackathon-2026
```

### 2. Configure Environment Variables
Create a `.env` file at the project root (`ET-Hackathon-2026/.env`):
```env
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=et_finance
JWT_SECRET_KEY=your_secret_key
GEMINI_API_KEY=your_gemini_api_key
AI_SERVICE_URL=http://127.0.0.1:5000
```

Then create `et-frontend/.env.local`:
```env
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=et_finance
JWT_SECRET_KEY=your_secret_key
AI_SERVICE_URL=http://127.0.0.1:5000
NEXT_PUBLIC_USE_LOCAL_ENGINE=false
```

### 3. Frontend + API Setup (Next.js)
The frontend includes the backend API routes (auth, CRUD, DB) in the same process.
```bash
cd et-frontend
npm install
npm run dev
```
> The app runs at [http://localhost:3000](http://localhost:3000). API routes are at `/api/*`.

### 4. AI Microservice (Python) -- only needed for AI features
```bash
cd et-backend
python -m venv .venv
# Windows: .\.venv\Scripts\Activate
# Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 5000 --workers 1
```
> AI service runs at [http://127.0.0.1:5000](http://127.0.0.1:5000). Only needed when using AI-powered features (FIRE planning, tax analysis, etc.).

---

## Architecture

- **Next.js** (single process): Frontend + API Routes (auth, CRUD, MongoDB)
- **Python FastAPI** (lightweight): AI generation (Gemini API) + financial calculators
- **MongoDB Atlas**: Database

## Built With
* **Frontend + API:** Next.js 16, React 19, TailwindCSS 4, Zustand, MongoDB native driver
* **AI Service:** FastAPI, Google Gemini API
* **Database:** MongoDB Atlas

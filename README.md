
  <h1>ET Finance Mentor</h1>
  <p><strong>AI-Powered Personal Finance Planning for India</strong></p>
  <p>From confused saver to confident investor. Get holistic, automated financial planning including FIRE tracking, mutual fund X-rays, tax wizards, and money health scoring.</p>
</div>

<br />

## 🚀 Quick Start Guide

Follow these steps to get both the FastAPI backend and Next.js frontend running locally on your machine.

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/sakhareritesh/ET-Hackathon-2026.git
cd ET-Hackathon-2026
```

### 2️⃣ Backend Setup (FastAPI)
The backend requires Python 3.10+ and uses MongoDB for the database. 

1. **Navigate to the backend directory and set up a virtual environment:**
```bash
cd et-backend
python -m venv .venv

# On Windows:
.\.venv\Scripts\Activate
# On Mac/Linux:
source .venv/bin/activate
```

2. **Install all dependencies:**
```bash
pip install -r requirements.txt
```

3. **Configure Environment Variables:**
Create a `.env` file at the root of the project (`ET-Hackathon-2026/.env`) with the following keys:
```env
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=et_finance
JWT_SECRET_KEY=your_secret_key
JWT_ALGORITHM=HS256
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
```

4. **Run the Backend API Server:**
```bash
uvicorn app.main:app --reload
```
> The API will be available at [http://127.0.0.1:8000](http://127.0.0.1:8000). You can view the swagger UI at `http://127.0.0.1:8000/docs`.


### 3️⃣ Frontend Setup (Next.js)
The frontend uses Next.js, React, TailwindCSS, and Zustand for state management.

1. **Open a new terminal and navigate to the frontend directory:**
```bash
cd et-frontend
```

2. **Install Node modules:**
```bash
npm install
```

3. **Start the Development Server:**
```bash
npm run dev
```
> The application will be available at [http://localhost:3000](http://localhost:3000).

---

## 🛠️ Built With
* **Frontend:** Next.js 14, React, TailwindCSS, Zustand, Lucide Icons
* **Backend:** FastAPI, Python, Motor (Async MongoDB), Bcrypt
* **Database:** MongoDB Atlas
* **AI Integration:** Google Gemini / OpenAI Models

from pydantic import BaseModel
from functools import lru_cache
from pathlib import Path
import os
from dotenv import load_dotenv

_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_ENV_FILE)


class Settings(BaseModel):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    AI_PORT: int = int(os.getenv("AI_PORT", "5000"))
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]


@lru_cache()
def get_settings() -> Settings:
    return Settings()

import google.generativeai as genai
from app.config import get_settings

settings = get_settings()
genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-pro")


async def generate(prompt: str, system_prompt: str = "") -> str:
    try:
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        return f"AI generation failed: {str(e)}"


async def generate_json(prompt: str, system_prompt: str = "") -> str:
    json_instruction = "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation."
    return await generate(prompt + json_instruction, system_prompt)

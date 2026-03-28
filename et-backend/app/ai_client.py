"""AI client — Groq only (Mixtral-8x7B)."""

import json
from app.config import get_settings

settings = get_settings()

_groq_client = None
if settings.GROQ_API_KEY:
    try:
        from groq import Groq
        _groq_client = Groq(api_key=settings.GROQ_API_KEY)
    except Exception:
        _groq_client = None


async def _groq_generate(prompt: str, system_prompt: str = "", json_mode: bool = False) -> str:
    if not _groq_client:
        raise RuntimeError("Groq client not configured — set GROQ_API_KEY in .env")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    kwargs: dict = {
        "model": "mixtral-8x7b-32768",
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 4096,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = _groq_client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


async def generate(prompt: str, system_prompt: str = "") -> str:
    if _groq_client:
        try:
            return await _groq_generate(prompt, system_prompt)
        except Exception as e:
            return f"AI generation failed: {e}"
    return "No AI provider configured. Set GROQ_API_KEY in .env"


async def generate_json(prompt: str, system_prompt: str = "") -> str:
    json_instruction = "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation, no code fences."
    if _groq_client:
        try:
            return await _groq_generate(prompt + json_instruction, system_prompt, json_mode=True)
        except Exception:
            pass
    return "{}"


async def generate_with_tools(
    messages: list[dict],
    tools: list[dict],
    system_prompt: str = "",
) -> dict:
    """Generate a response with tool-calling support (Groq native)."""
    if not _groq_client:
        return {"type": "text", "content": await generate(messages[-1].get("content", ""), system_prompt)}

    all_messages = []
    if system_prompt:
        all_messages.append({"role": "system", "content": system_prompt})
    all_messages.extend(messages)

    try:
        response = _groq_client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=all_messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.3,
            max_tokens=4096,
        )

        choice = response.choices[0]
        if choice.message.tool_calls:
            return {
                "type": "tool_calls",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "function": tc.function.name,
                        "arguments": json.loads(tc.function.arguments),
                    }
                    for tc in choice.message.tool_calls
                ],
            }
        return {"type": "text", "content": choice.message.content or ""}
    except Exception:
        return {"type": "text", "content": await generate(messages[-1].get("content", ""), system_prompt)}

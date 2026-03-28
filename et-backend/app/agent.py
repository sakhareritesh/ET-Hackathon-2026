"""Agentic AI pipeline with tool-calling for the Money Mentor.

Classifies user intent, routes to the appropriate calculator/tool,
then formats results into a conversational response.
"""

import json
from app.ai_client import generate, generate_json
from app.calculators.tax_calculator import calculate_tax_old, calculate_tax_new
from app.calculators.sip_calculator import calculate_sip, calculate_future_value
from app.calculators.xirr_calculator import calculate_xirr
from app.calculators.asset_allocator import get_allocation_by_age
from app.calculators.insurance_calculator import calculate_insurance_need

TOOL_DEFINITIONS = [
    {
        "name": "calculate_sip",
        "description": "Calculate monthly SIP needed to reach a financial goal",
        "parameters": {"target": "float", "years": "int", "annual_return": "float (default 12)"},
    },
    {
        "name": "calculate_future_value",
        "description": "Calculate future value of a monthly SIP investment",
        "parameters": {"sip": "float", "years": "int", "annual_return": "float (default 12)"},
    },
    {
        "name": "compare_tax_regimes",
        "description": "Compare old vs new tax regime for a given salary",
        "parameters": {"gross_salary": "float", "sec_80c": "float", "sec_80d": "float", "hra_exemption": "float", "nps": "float"},
    },
    {
        "name": "calculate_insurance_need",
        "description": "Calculate recommended life insurance cover",
        "parameters": {"annual_income": "float", "age": "int", "outstanding_debts": "float", "dependents": "int"},
    },
    {
        "name": "asset_allocation",
        "description": "Get recommended asset allocation based on age and risk",
        "parameters": {"age": "int", "risk_profile": "str"},
    },
]

AGENT_SYSTEM_PROMPT = """You are DhanGuru, an expert AI financial mentor for Indian users.
You have access to financial calculators. When a user asks a question that needs computation,
identify which tool to call, extract parameters from their message/context, and respond with
a JSON object:

{
  "intent": "<one of: sip_calc, future_value, tax_compare, insurance_need, asset_allocation, general_advice>",
  "tool_params": { ... extracted parameters ... },
  "follow_up_text": "Brief explanation to accompany the result"
}

If no tool is needed (general advice), use intent "general_advice" and put your full advice
in "follow_up_text".

Available tools and their parameters:
- sip_calc: target (float), years (int), annual_return (float, default 12)
- future_value: sip (float), years (int), annual_return (float, default 12)
- tax_compare: gross_salary (float), sec_80c (float, default 0), sec_80d (float, default 0), hra_exemption (float, default 0), nps (float, default 0)
- insurance_need: annual_income (float), age (int), outstanding_debts (float, default 0), dependents (int, default 1)
- asset_allocation: age (int), risk_profile (str, default "moderate")

Always respond in valid JSON. Use Indian Rupee for amounts. Be specific and actionable."""


def _execute_tool(intent: str, params: dict) -> dict:
    """Execute the identified tool with extracted parameters."""
    if intent == "sip_calc":
        result = calculate_sip(
            target=params.get("target", 0),
            years=params.get("years", 10),
            annual_return=params.get("annual_return", 12),
        )
        return {"tool": "SIP Calculator", "monthly_sip_needed": result}

    if intent == "future_value":
        result = calculate_future_value(
            sip=params.get("sip", 0),
            years=params.get("years", 10),
            annual_return=params.get("annual_return", 12),
        )
        return {"tool": "Future Value Calculator", "future_value": result}

    if intent == "tax_compare":
        old = calculate_tax_old(
            gross_salary=params.get("gross_salary", 0),
            sec_80c=params.get("sec_80c", 0),
            sec_80d=params.get("sec_80d", 0),
            hra_exemption=params.get("hra_exemption", 0),
            nps=params.get("nps", 0),
        )
        new = calculate_tax_new(gross_salary=params.get("gross_salary", 0))
        savings = abs(old["total_tax"] - new["total_tax"])
        recommended = "old" if old["total_tax"] < new["total_tax"] else "new"
        return {
            "tool": "Tax Regime Comparator",
            "old_regime_tax": old["total_tax"],
            "new_regime_tax": new["total_tax"],
            "savings": savings,
            "recommended_regime": recommended,
        }

    if intent == "insurance_need":
        result = calculate_insurance_need(
            annual_income=params.get("annual_income", 0),
            age=params.get("age", 30),
            outstanding_debts=params.get("outstanding_debts", 0),
            dependents=params.get("dependents", 1),
        )
        return {"tool": "Insurance Calculator", **result}

    if intent == "asset_allocation":
        result = get_allocation_by_age(
            age=params.get("age", 30),
            risk_profile=params.get("risk_profile", "moderate"),
        )
        return {"tool": "Asset Allocator", "allocation": result}

    return {}


async def run_agent(message: str, context: dict = None) -> dict:
    """Run the agentic pipeline: classify intent → execute tool → format response."""
    context_text = json.dumps(context, indent=2) if context else "No financial context provided."

    prompt = f"""User message: {message}

User financial context:
{context_text}

Analyze the user's message. If they need a calculation, identify the tool and parameters.
Respond with JSON as specified in the system prompt."""

    try:
        raw = await generate_json(prompt, AGENT_SYSTEM_PROMPT)
        parsed = json.loads(raw)
    except (json.JSONDecodeError, Exception):
        response_text = await generate(
            f"User asks: {message}\n\nContext: {context_text}\n\n"
            "Provide helpful, actionable financial advice for an Indian user. "
            "Be specific with numbers where possible.",
            "You are DhanGuru, an expert Indian financial advisor."
        )
        return {
            "response": response_text,
            "tool_used": None,
            "tool_result": None,
            "suggestions": ["Calculate my SIP", "Compare tax regimes", "Check insurance gap"],
        }

    intent = parsed.get("intent", "general_advice")
    tool_params = parsed.get("tool_params", {})
    follow_up = parsed.get("follow_up_text", "")

    if intent == "general_advice":
        return {
            "response": follow_up or parsed.get("advice", "I can help with SIP calculations, tax planning, insurance analysis, and more. What would you like to know?"),
            "tool_used": None,
            "tool_result": None,
            "suggestions": ["Calculate SIP for a goal", "Compare old vs new tax regime", "Check my insurance needs"],
        }

    tool_result = _execute_tool(intent, tool_params)

    format_prompt = f"""You ran a financial calculation for the user. Present the results naturally.

User question: {message}
Tool used: {tool_result.get('tool', intent)}
Calculation result: {json.dumps(tool_result)}
Your earlier context: {follow_up}

Write a helpful, conversational response that:
1. States the key result clearly
2. Explains what it means for the user
3. Gives one actionable next step
Keep it concise (3-5 sentences). Use ₹ for amounts."""

    formatted = await generate(format_prompt, "You are DhanGuru, an expert Indian financial advisor. Be concise and actionable.")

    return {
        "response": formatted,
        "tool_used": tool_result.get("tool", intent),
        "tool_result": tool_result,
        "suggestions": _get_follow_up_suggestions(intent),
    }


def _get_follow_up_suggestions(intent: str) -> list[str]:
    suggestions_map = {
        "sip_calc": ["What if I increase my SIP?", "Show my asset allocation", "Check my tax savings"],
        "future_value": ["Calculate SIP for a goal", "Compare tax regimes", "Review my FIRE plan"],
        "tax_compare": ["Find my missed deductions", "Calculate my SIP needs", "Check my insurance gap"],
        "insurance_need": ["Calculate SIP for goals", "Get my Money Health Score", "Compare tax regimes"],
        "asset_allocation": ["Calculate SIP amounts", "Review my FIRE plan", "Check my portfolio overlap"],
    }
    return suggestions_map.get(intent, ["Calculate my SIP", "Compare tax regimes", "Check insurance"])

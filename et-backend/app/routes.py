import json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.ai_client import generate_json
from app.prompts.fire_prompts import FIRE_SYSTEM_PROMPT, FIRE_PLAN_PROMPT
from app.prompts.health_prompts import HEALTH_SYSTEM_PROMPT, HEALTH_SCORE_PROMPT
from app.prompts.tax_prompts import TAX_SYSTEM_PROMPT, TAX_ANALYSIS_PROMPT
from app.prompts.event_prompts import EVENT_SYSTEM_PROMPT, EVENT_ADVICE_PROMPT
from app.prompts.mf_prompts import MF_SYSTEM_PROMPT, MF_REBALANCE_PROMPT
from app.calculators.sip_calculator import calculate_sip
from app.calculators.asset_allocator import get_allocation_by_age
from app.calculators.tax_calculator import calculate_tax_old, calculate_tax_new
from app.calculators.xirr_calculator import calculate_xirr

router = APIRouter()


# ── Request models ──────────────────────────────────────────────────


class GoalInput(BaseModel):
    name: str
    category: str
    target_amount: float
    current_savings: float = 0
    target_date: str
    priority: str = "medium"


class FireRequest(BaseModel):
    age: int
    retirement_age: int = 55
    monthly_income: float
    monthly_expenses: float
    existing_corpus: float = 0
    expected_return_rate: float = 12.0
    inflation_rate: float = 6.0
    risk_profile: str = "moderate"
    goals: list[GoalInput] = []


class HealthRequest(BaseModel):
    monthly_income: float
    monthly_expenses: float
    emergency_fund: float = 0
    emergency_months: float = 0
    has_life_insurance: bool = False
    life_cover: float = 0
    has_health_insurance: bool = False
    health_cover: float = 0
    total_investments: float = 0
    investment_breakdown: dict = {}
    total_emi: float = 0
    debt_ratio: float = 0
    tax_regime: str = "new"
    risk_profile: str = "moderate"


class TaxIncomeDetails(BaseModel):
    gross_salary: float = 0
    hra_received: float = 0
    income_from_other_sources: float = 0
    standard_deduction: float = 50000


class TaxSection80C(BaseModel):
    total: float = 0


class TaxSection80D(BaseModel):
    total: float = 0


class TaxDeductions(BaseModel):
    section_80c: TaxSection80C = TaxSection80C()
    section_80d: TaxSection80D = TaxSection80D()
    nps_80ccd_1b: float = 0
    home_loan_interest_24b: float = 0
    education_loan_80e: float = 0
    donations_80g: float = 0
    savings_interest_80tta: float = 0
    hra_exemption: float = 0


class TaxRequest(BaseModel):
    financial_year: str = "2025-26"
    income_details: TaxIncomeDetails
    deductions: TaxDeductions
    risk_profile: str = "moderate"


class EventRequest(BaseModel):
    event_type: str
    event_date: str
    amount: float = 0
    description: str = ""
    annual_income: float = 0
    risk_profile: str = "moderate"
    tax_regime: str = "new"
    investments_summary: str = "None"
    debts_summary: str = "No debts"
    life_cover: float = 0
    health_cover: float = 0


class HoldingInput(BaseModel):
    fund_name: str
    category: str = "N/A"
    current_value: float = 0
    invested_amount: float = 0
    expense_ratio: float = 0
    xirr: float = 0
    transactions: list[dict] = []


class MFRequest(BaseModel):
    holdings: list[HoldingInput] = []
    risk_profile: str = "moderate"


# ── Endpoints ───────────────────────────────────────────────────────


@router.post("/ai/fire/plan")
async def fire_plan(req: FireRequest):
    goals_text = ""
    for i, g in enumerate(req.goals, 1):
        goals_text += f"{i}. {g.name} ({g.category}): ₹{g.target_amount:,.0f} by {g.target_date}\n"

    prompt = FIRE_PLAN_PROMPT.format(
        age=req.age,
        retirement_age=req.retirement_age,
        monthly_income=req.monthly_income,
        monthly_expenses=req.monthly_expenses,
        existing_corpus=req.existing_corpus,
        risk_profile=req.risk_profile,
        expected_return=req.expected_return_rate,
        inflation_rate=req.inflation_rate,
        goals_text=goals_text or "No specific goals provided",
    )

    ai_response = await generate_json(prompt, FIRE_SYSTEM_PROMPT)

    fire_number = req.monthly_expenses * 12 * 25
    years_to_fire = req.retirement_age - req.age
    monthly_sip = calculate_sip(
        target=fire_number - req.existing_corpus,
        years=years_to_fire,
        annual_return=req.expected_return_rate,
    )
    allocation = get_allocation_by_age(req.age, req.risk_profile)

    goal_results = []
    from datetime import datetime
    for goal in req.goals:
        try:
            target_year = int(goal.target_date.split("-")[0])
        except Exception:
            target_year = datetime.now().year + 5
        goal_sip = calculate_sip(
            target=goal.target_amount - goal.current_savings,
            years=max(target_year - datetime.now().year, 1),
            annual_return=req.expected_return_rate,
        )
        goal_results.append({
            "name": goal.name,
            "category": goal.category,
            "target_amount": goal.target_amount,
            "current_savings": goal.current_savings,
            "target_date": goal.target_date,
            "priority": goal.priority,
            "sip_required": goal_sip,
            "recommended_asset_allocation": allocation,
        })

    try:
        ai_data = json.loads(ai_response)
        ai_summary = ai_data.get("ai_summary", "Plan generated successfully.")
        insurance_gaps = ai_data.get("insurance_gaps", [])
        tax_moves = ai_data.get("tax_saving_moves", [])
    except (json.JSONDecodeError, Exception):
        ai_summary = "Your FIRE plan has been generated. Review your goals and SIP amounts below."
        insurance_gaps = []
        tax_moves = []

    return {
        "fire_number": fire_number,
        "years_to_fire": years_to_fire,
        "monthly_sip_needed": monthly_sip,
        "goals": goal_results,
        "asset_allocation": allocation,
        "insurance_gaps": insurance_gaps,
        "tax_saving_moves": tax_moves,
        "emergency_fund_target": req.monthly_expenses * 6,
        "ai_summary": ai_summary,
    }


@router.post("/ai/health/score")
async def health_score(req: HealthRequest):
    prompt = HEALTH_SCORE_PROMPT.format(
        monthly_income=req.monthly_income,
        monthly_expenses=req.monthly_expenses,
        emergency_fund=req.emergency_fund,
        emergency_months=req.emergency_months,
        has_life_insurance=req.has_life_insurance,
        life_cover=req.life_cover,
        has_health_insurance=req.has_health_insurance,
        health_cover=req.health_cover,
        total_investments=req.total_investments,
        investment_breakdown=json.dumps(req.investment_breakdown),
        total_emi=req.total_emi,
        debt_ratio=req.debt_ratio,
        tax_regime=req.tax_regime,
        risk_profile=req.risk_profile,
    )

    ai_response = await generate_json(prompt, HEALTH_SYSTEM_PROMPT)

    try:
        return json.loads(ai_response)
    except (json.JSONDecodeError, Exception):
        return {
            "overall_score": 50,
            "dimensions": {
                "emergency_preparedness": {"score": 50, "status": "needs_improvement", "details": "Review your emergency fund.", "actions": ["Build 6 months of expenses"]},
                "insurance_coverage": {"score": 50, "status": "needs_improvement", "details": "Review coverage.", "actions": ["Get term life insurance"]},
                "investment_diversification": {"score": 50, "status": "needs_improvement", "details": "Diversify.", "actions": ["Spread across asset classes"]},
                "debt_health": {"score": 70, "status": "good", "details": "Manageable debt.", "actions": []},
                "tax_efficiency": {"score": 50, "status": "needs_improvement", "details": "Optimize deductions.", "actions": ["Max out 80C"]},
                "retirement_readiness": {"score": 40, "status": "needs_improvement", "details": "Start planning.", "actions": ["Start SIP for retirement"]},
            },
            "ai_summary": "Your financial health needs attention in several areas. Start with emergency fund and insurance.",
            "top_3_actions": [],
        }


@router.post("/ai/tax/analyze")
async def tax_analyze(req: TaxRequest):
    income = req.income_details
    deductions = req.deductions

    old_tax = calculate_tax_old(
        gross_salary=income.gross_salary,
        hra_exemption=deductions.hra_exemption,
        standard_deduction=income.standard_deduction,
        sec_80c=deductions.section_80c.total,
        sec_80d=deductions.section_80d.total,
        nps=deductions.nps_80ccd_1b,
        home_loan_interest=deductions.home_loan_interest_24b,
        other_deductions=(
            deductions.education_loan_80e
            + deductions.donations_80g
            + deductions.savings_interest_80tta
        ),
    )
    new_tax = calculate_tax_new(gross_salary=income.gross_salary)

    regime_comparison = {
        "old_regime": old_tax,
        "new_regime": new_tax,
        "recommended_regime": "old" if old_tax["total_tax"] < new_tax["total_tax"] else "new",
        "savings": abs(old_tax["total_tax"] - new_tax["total_tax"]),
    }

    prompt = TAX_ANALYSIS_PROMPT.format(
        financial_year=req.financial_year,
        gross_salary=income.gross_salary,
        hra_received=income.hra_received,
        other_income=income.income_from_other_sources,
        sec_80c=deductions.section_80c.total,
        sec_80d=deductions.section_80d.total,
        nps=deductions.nps_80ccd_1b,
        home_loan_interest=deductions.home_loan_interest_24b,
        hra_exemption=deductions.hra_exemption,
        risk_profile=req.risk_profile,
    )

    ai_response = await generate_json(prompt, TAX_SYSTEM_PROMPT)

    try:
        ai_data = json.loads(ai_response)
        missed = ai_data.get("missed_deductions", [])
        investments = ai_data.get("tax_saving_investments", [])
        ai_summary = ai_data.get("ai_summary", "")
    except (json.JSONDecodeError, Exception):
        missed = []
        investments = []
        ai_summary = "Tax analysis complete. Review regime comparison above."

    return {
        "regime_comparison": regime_comparison,
        "missed_deductions": missed,
        "tax_saving_investments": investments,
        "ai_summary": ai_summary,
    }


@router.post("/ai/events/advise")
async def event_advise(req: EventRequest):
    prompt = EVENT_ADVICE_PROMPT.format(
        event_type=req.event_type,
        event_date=req.event_date,
        amount=req.amount,
        description=req.description,
        annual_income=req.annual_income,
        risk_profile=req.risk_profile,
        tax_regime=req.tax_regime,
        investments_summary=req.investments_summary,
        debts_summary=req.debts_summary,
        life_cover=req.life_cover,
        health_cover=req.health_cover,
    )

    ai_response = await generate_json(prompt, EVENT_SYSTEM_PROMPT)

    try:
        return json.loads(ai_response)
    except (json.JSONDecodeError, Exception):
        return {
            "summary": "Please consult with a financial advisor for personalized advice on this life event.",
            "tax_implications": "Tax implications depend on the specific event details.",
            "investment_recommendations": [],
            "action_checklist": [],
        }


@router.post("/ai/mf/analyze")
async def mf_analyze(req: MFRequest):
    for holding in req.holdings:
        if holding.transactions:
            holding.xirr = calculate_xirr(holding.transactions, holding.current_value)

    total_invested = sum(h.invested_amount for h in req.holdings)
    total_current = sum(h.current_value for h in req.holdings)
    overall_xirr = ((total_current / max(total_invested, 1)) - 1) * 100
    expense_drag = sum(h.expense_ratio * h.current_value / 100 for h in req.holdings)

    # Simplified overlap
    category_map: dict[str, list[str]] = {}
    for h in req.holdings:
        cat = h.category
        if cat not in category_map:
            category_map[cat] = []
        category_map[cat].append(h.fund_name)

    overlap = []
    for cat, funds in category_map.items():
        if len(funds) > 1:
            overlap.append({
                "stock_name": f"{cat} category overlap",
                "funds_holding": funds,
                "total_weight_pct": len(funds) * 10,
            })

    overlap_pct = sum(o["total_weight_pct"] for o in overlap[:10]) / max(len(overlap), 1)

    holdings_text = "\n".join(
        f"- {h.fund_name} ({h.category}): ₹{h.current_value:,.0f}, "
        f"XIRR: {h.xirr:.1f}%, ER: {h.expense_ratio:.2f}%"
        for h in req.holdings
    )
    overlap_text = "\n".join(
        f"- {o['stock_name']}: in {len(o['funds_holding'])} funds, weight {o['total_weight_pct']:.1f}%"
        for o in overlap[:10]
    )

    prompt = MF_REBALANCE_PROMPT.format(
        total_invested=total_invested,
        current_value=total_current,
        overall_xirr=overall_xirr,
        expense_drag=expense_drag,
        overlap_pct=overlap_pct,
        holdings_text=holdings_text or "No holdings parsed",
        overlap_text=overlap_text or "No overlap detected",
        risk_profile=req.risk_profile,
    )
    ai_response = await generate_json(prompt, MF_SYSTEM_PROMPT)

    try:
        ai_data = json.loads(ai_response)
        rebalancing = ai_data.get("rebalancing_suggestions", [])
        ai_summary = ai_data.get("ai_summary", "")
    except (json.JSONDecodeError, Exception):
        rebalancing = []
        ai_summary = "Portfolio analysis complete."

    return {
        "holdings": [h.model_dump() for h in req.holdings],
        "portfolio_summary": {
            "total_invested": total_invested,
            "total_current_value": total_current,
            "total_returns": total_current - total_invested,
            "overall_xirr": overall_xirr,
            "expense_ratio_drag": expense_drag,
            "overlap_pct": overlap_pct,
        },
        "overlap_analysis": overlap,
        "rebalancing_suggestions": rebalancing,
        "ai_summary": ai_summary,
    }

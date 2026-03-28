import json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.ai_client import generate_json, generate
from app.prompts.fire_prompts import FIRE_SYSTEM_PROMPT, FIRE_PLAN_PROMPT
from app.prompts.health_prompts import HEALTH_SYSTEM_PROMPT, HEALTH_SCORE_PROMPT
from app.prompts.tax_prompts import TAX_SYSTEM_PROMPT, TAX_ANALYSIS_PROMPT
from app.prompts.event_prompts import EVENT_SYSTEM_PROMPT, EVENT_ADVICE_PROMPT
from app.prompts.mf_prompts import MF_SYSTEM_PROMPT, MF_REBALANCE_PROMPT
from app.prompts.mentor_prompts import MENTOR_SYSTEM_PROMPT, MENTOR_CHAT_PROMPT
from app.calculators.sip_calculator import calculate_sip, calculate_future_value
from app.calculators.asset_allocator import get_allocation_by_age
from app.calculators.tax_calculator import calculate_tax_old, calculate_tax_new
from app.calculators.xirr_calculator import calculate_xirr
from app.calculators.insurance_calculator import calculate_insurance_need
from app.calculators.monte_carlo import run_fire_simulation
from app.agent import run_agent
from app.parsers.form16_parser import parse_form16_text
from app.parsers.cams_parser import parse_cams_csv

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
    volatility: float = 15.0
    risk_profile: str = "moderate"
    goals: list[GoalInput] = []
    run_monte_carlo: bool = True


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
    age: int = 30
    dependents: int = 0


class TaxIncomeDetails(BaseModel):
    gross_salary: float = 0
    basic_salary: float = 0
    hra_received: float = 0
    income_from_other_sources: float = 0
    standard_deduction: float = 50000
    rent_paid: float = 0
    is_metro: bool = True


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


class MentorRequest(BaseModel):
    message: str
    context: dict = {}


class Form16ParseRequest(BaseModel):
    text: str


class CAMSParseRequest(BaseModel):
    rows: list[dict]


class SIPCalcRequest(BaseModel):
    target: float
    years: int
    annual_return: float = 12.0


class TaxCompareRequest(BaseModel):
    gross_salary: float
    sec_80c: float = 0
    sec_80d: float = 0
    hra_exemption: float = 0
    nps: float = 0
    home_loan_interest: float = 0


class InsuranceGapRequest(BaseModel):
    annual_income: float
    age: int
    outstanding_debts: float = 0
    dependents: int = 1
    current_life_cover: float = 0
    current_health_cover: float = 0


class AssetAllocationRequest(BaseModel):
    age: int
    risk_profile: str = "moderate"


class CouplesRequest(BaseModel):
    partner_a: dict
    partner_b: dict


# ── AI-Powered Endpoints ───────────────────────────────────────────


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

    # Monte Carlo simulation
    monte_carlo_data = None
    if req.run_monte_carlo:
        try:
            monte_carlo_data = run_fire_simulation(
                current_age=req.age,
                target_fire_age=req.retirement_age,
                current_corpus=req.existing_corpus,
                monthly_sip=monthly_sip,
                monthly_expenses=req.monthly_expenses,
                expected_return=req.expected_return_rate,
                volatility=req.volatility,
                inflation_rate=req.inflation_rate,
                n_simulations=5000,
            )
        except Exception:
            monte_carlo_data = None

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
        "monte_carlo": monte_carlo_data,
    }


@router.post("/ai/health/score")
async def health_score(req: HealthRequest):
    # Deterministic scoring
    emergency_score = min(100, (req.emergency_months / 6) * 100) if req.emergency_months > 0 else min(100, (req.emergency_fund / max(req.monthly_expenses * 6, 1)) * 100)

    ideal_life_cover = req.monthly_income * 12 * max(60 - req.age, 10)
    life_score = min(50, (req.life_cover / max(ideal_life_cover, 1)) * 50) if req.has_life_insurance else 0
    health_score_val = 25 if req.has_health_insurance else 0
    health_adequate = 25 if req.health_cover >= 500000 else (req.health_cover / 500000) * 25
    insurance_score = life_score + health_score_val + health_adequate

    n_classes = len(req.investment_breakdown) if req.investment_breakdown else (1 if req.total_investments > 0 else 0)
    investment_score = min(100, n_classes * 25)

    debt_score = max(0, (1 - req.debt_ratio / 0.5) * 100) if req.debt_ratio < 0.5 else 0

    tax_score = 50

    retirement_target = req.monthly_expenses * 12 * 25
    retirement_score = min(100, (req.total_investments / max(retirement_target, 1)) * 100)

    dimensions = {
        "emergency_preparedness": {"score": round(emergency_score), "max": 100},
        "insurance_coverage": {"score": round(insurance_score), "max": 100},
        "investment_diversification": {"score": round(investment_score), "max": 100},
        "debt_health": {"score": round(debt_score), "max": 100},
        "tax_efficiency": {"score": round(tax_score), "max": 100},
        "retirement_readiness": {"score": round(retirement_score), "max": 100},
    }

    weights = [0.20, 0.15, 0.20, 0.15, 0.10, 0.20]
    scores = [emergency_score, insurance_score, investment_score, debt_score, tax_score, retirement_score]
    overall = sum(s * w for s, w in zip(scores, weights))

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
        ai_data = json.loads(ai_response)
        ai_summary = ai_data.get("ai_summary", "")
        top_actions = ai_data.get("top_3_actions", [])
        for dim_key in dimensions:
            if dim_key in ai_data.get("dimensions", {}):
                ai_dim = ai_data["dimensions"][dim_key]
                dimensions[dim_key]["status"] = ai_dim.get("status", "")
                dimensions[dim_key]["details"] = ai_dim.get("details", "")
                dimensions[dim_key]["actions"] = ai_dim.get("actions", [])
    except (json.JSONDecodeError, Exception):
        ai_summary = "Review your financial health across all dimensions."
        top_actions = []

    return {
        "overall_score": round(overall),
        "dimensions": dimensions,
        "ai_summary": ai_summary,
        "top_3_actions": top_actions,
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

    # Missed deductions analysis
    missed = []
    if deductions.section_80c.total < 150000:
        gap = 150000 - deductions.section_80c.total
        missed.append({
            "section": "80C",
            "current": deductions.section_80c.total,
            "max": 150000,
            "gap": gap,
            "potential_savings": round(gap * 0.3),
            "suggestions": ["ELSS Mutual Funds", "PPF", "5-year Tax Saver FD", "Life Insurance Premium"],
        })
    if deductions.section_80d.total < 25000:
        gap = 25000 - deductions.section_80d.total
        missed.append({
            "section": "80D",
            "current": deductions.section_80d.total,
            "max": 25000,
            "gap": gap,
            "potential_savings": round(gap * 0.3),
            "suggestions": ["Health Insurance for self & family"],
        })
    if deductions.nps_80ccd_1b < 50000:
        gap = 50000 - deductions.nps_80ccd_1b
        missed.append({
            "section": "80CCD(1B) - NPS",
            "current": deductions.nps_80ccd_1b,
            "max": 50000,
            "gap": gap,
            "potential_savings": round(gap * 0.3),
            "suggestions": ["National Pension System (NPS) contribution"],
        })

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
        investments = ai_data.get("tax_saving_investments", [])
        ai_summary = ai_data.get("ai_summary", "")
    except (json.JSONDecodeError, Exception):
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
            "insurance_changes": [],
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

    # Expense drag over time
    expense_drag_projections = {
        "10_years": round(expense_drag * 10 * 1.5, 0),
        "20_years": round(expense_drag * 20 * 2.5, 0),
        "30_years": round(expense_drag * 30 * 4.0, 0),
    }

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
            "expense_drag_projections": expense_drag_projections,
            "overlap_pct": overlap_pct,
        },
        "overlap_analysis": overlap,
        "rebalancing_suggestions": rebalancing,
        "ai_summary": ai_summary,
    }


# ── Agentic Mentor Chat ─────────────────────────────────────────────


@router.post("/ai/mentor/chat")
async def mentor_chat(req: MentorRequest):
    result = await run_agent(req.message, req.context)
    return result


# ── Document Parsing ─────────────────────────────────────────────────


@router.post("/ai/tax/parse-form16")
async def parse_form16(req: Form16ParseRequest):
    return parse_form16_text(req.text)


@router.post("/ai/mf/parse-cams")
async def parse_cams(req: CAMSParseRequest):
    return parse_cams_csv(req.rows)


# ── Direct Calculator Endpoints ──────────────────────────────────────


@router.post("/calc/sip")
async def calc_sip(req: SIPCalcRequest):
    monthly = calculate_sip(req.target, req.years, req.annual_return)
    fv = calculate_future_value(monthly, req.years, req.annual_return)
    return {
        "monthly_sip": monthly,
        "total_investment": round(monthly * req.years * 12, 0),
        "future_value": fv,
        "wealth_gain": round(fv - monthly * req.years * 12, 0),
    }


@router.post("/calc/tax/compare")
async def calc_tax_compare(req: TaxCompareRequest):
    old = calculate_tax_old(
        gross_salary=req.gross_salary,
        sec_80c=req.sec_80c,
        sec_80d=req.sec_80d,
        hra_exemption=req.hra_exemption,
        nps=req.nps,
        home_loan_interest=req.home_loan_interest,
    )
    new = calculate_tax_new(req.gross_salary)
    return {
        "old_regime": old,
        "new_regime": new,
        "recommended": "old" if old["total_tax"] < new["total_tax"] else "new",
        "savings": abs(old["total_tax"] - new["total_tax"]),
    }


@router.post("/calc/insurance-gap")
async def calc_insurance_gap(req: InsuranceGapRequest):
    need = calculate_insurance_need(
        req.annual_income, req.age, req.outstanding_debts, req.dependents,
    )
    gap = max(0, need["recommended_cover"] - req.current_life_cover)
    return {
        **need,
        "current_cover": req.current_life_cover,
        "gap": gap,
        "gap_pct": round(gap / max(need["recommended_cover"], 1) * 100, 1),
    }


@router.post("/calc/asset-allocation")
async def calc_asset_allocation(req: AssetAllocationRequest):
    allocation = get_allocation_by_age(req.age, req.risk_profile)
    return {"age": req.age, "risk_profile": req.risk_profile, "allocation": allocation}


# ── Couples Optimizer ────────────────────────────────────────────────


@router.post("/ai/couples/optimize")
async def couples_optimize(req: CouplesRequest):
    a = req.partner_a
    b = req.partner_b

    a_salary = a.get("gross_salary", 0)
    b_salary = b.get("gross_salary", 0)
    rent = a.get("rent_paid", 0) or b.get("rent_paid", 0)

    # HRA optimization
    a_basic = a.get("basic_salary", a_salary * 0.4)
    b_basic = b.get("basic_salary", b_salary * 0.4)
    a_hra_exempt = min(a.get("hra_received", 0), a_basic * 0.5, max(0, rent * 12 - a_basic * 0.1))
    b_hra_exempt = min(b.get("hra_received", 0), b_basic * 0.5, max(0, rent * 12 - b_basic * 0.1))
    hra_recommendation = "Partner A" if a_hra_exempt > b_hra_exempt else "Partner B"

    # Tax comparison for both
    a_old = calculate_tax_old(gross_salary=a_salary, hra_exemption=a_hra_exempt, sec_80c=a.get("sec_80c", 0))
    a_new = calculate_tax_new(a_salary)
    b_old = calculate_tax_old(gross_salary=b_salary, hra_exemption=b_hra_exempt, sec_80c=b.get("sec_80c", 0))
    b_new = calculate_tax_new(b_salary)

    combined_net_worth = (
        a.get("total_investments", 0) + b.get("total_investments", 0)
        - a.get("total_debts", 0) - b.get("total_debts", 0)
    )

    prompt = f"""Two partners want joint financial optimization.
Partner A: Salary ₹{a_salary:,.0f}, HRA exemption ₹{a_hra_exempt:,.0f}
Partner B: Salary ₹{b_salary:,.0f}, HRA exemption ₹{b_hra_exempt:,.0f}
Monthly rent: ₹{rent:,.0f}
Combined net worth: ₹{combined_net_worth:,.0f}

Provide optimization suggestions as JSON with keys:
hra_optimization, tax_split_80c, insurance_review, nps_strategy, sip_split, combined_fire_notes"""

    ai_response = await generate_json(prompt, "You are DhanGuru, expert in Indian couple's financial planning.")

    try:
        ai_data = json.loads(ai_response)
    except Exception:
        ai_data = {}

    return {
        "hra_optimization": {
            "recommendation": hra_recommendation,
            "partner_a_exemption": round(a_hra_exempt),
            "partner_b_exemption": round(b_hra_exempt),
            "note": ai_data.get("hra_optimization", f"{hra_recommendation} should claim HRA for maximum benefit."),
        },
        "tax_summary": {
            "partner_a": {"old": a_old["total_tax"], "new": a_new["total_tax"], "best": "old" if a_old["total_tax"] < a_new["total_tax"] else "new"},
            "partner_b": {"old": b_old["total_tax"], "new": b_new["total_tax"], "best": "old" if b_old["total_tax"] < b_new["total_tax"] else "new"},
            "combined_optimal_tax": min(a_old["total_tax"], a_new["total_tax"]) + min(b_old["total_tax"], b_new["total_tax"]),
        },
        "combined_net_worth": round(combined_net_worth),
        "ai_suggestions": ai_data,
    }


# ── Proactive Suggestions ───────────────────────────────────────────


@router.post("/ai/mentor/suggestions")
async def mentor_suggestions(req: MentorRequest):
    context = req.context or {}
    suggestions = []

    if not context.get("has_term_insurance"):
        suggestions.append({
            "type": "insurance",
            "message": "You don't have term life insurance. A ₹1 Cr policy could cost ~₹800/month.",
            "action": "Check insurance gap",
            "priority": "high",
        })
    if context.get("emergency_months", 0) < 3:
        suggestions.append({
            "type": "emergency",
            "message": "Your emergency fund covers less than 3 months. Target 6 months of expenses.",
            "action": "Build emergency fund plan",
            "priority": "high",
        })
    if context.get("sec_80c_used", 0) < 150000:
        gap = 150000 - context.get("sec_80c_used", 0)
        suggestions.append({
            "type": "tax",
            "message": f"You can save up to ₹{round(gap * 0.3):,} more in taxes by maximizing Section 80C.",
            "action": "See tax-saving options",
            "priority": "medium",
        })

    return {"suggestions": suggestions}

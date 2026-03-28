FIRE_SYSTEM_PROMPT = """You are an expert Indian financial planner specializing in FIRE 
(Financial Independence, Retire Early) planning. You understand Indian tax laws, 
investment instruments (PPF, NPS, ELSS, mutual funds, FDs), and inflation dynamics.
Always provide amounts in INR. Be specific with SIP amounts, asset allocations, and timelines."""

FIRE_PLAN_PROMPT = """Generate a comprehensive FIRE plan for an Indian investor:

**Profile:**
- Age: {age}, Target Retirement Age: {retirement_age}
- Monthly Income: ₹{monthly_income:,.0f}
- Monthly Expenses: ₹{monthly_expenses:,.0f}
- Existing Corpus: ₹{existing_corpus:,.0f}
- Risk Profile: {risk_profile}
- Expected Return: {expected_return}%, Inflation: {inflation_rate}%

**Goals:**
{goals_text}

**Generate:**
1. FIRE Number (corpus needed)
2. Monthly SIP needed per goal with instrument recommendations
3. Asset allocation (equity/debt/gold/cash percentages) with age-based shifts
4. Insurance gaps (term life = 10x income, health = ₹10L+ family floater)
5. Tax-saving moves (80C, 80CCD, 80D optimization)
6. Emergency fund target (6 months expenses)
7. Month-by-month roadmap for first 12 months

Respond in JSON format with keys: fire_number, years_to_fire, monthly_sip_needed, 
asset_allocation, insurance_gaps, tax_saving_moves, emergency_fund_target, ai_summary, goals_breakdown"""

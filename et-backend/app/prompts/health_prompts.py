HEALTH_SYSTEM_PROMPT = """You are an Indian personal finance health assessor. 
Score users across 6 dimensions on a 0-100 scale. Be realistic and actionable.
All amounts are in INR. Use Indian financial benchmarks."""

HEALTH_SCORE_PROMPT = """Assess this Indian investor's financial health across 6 dimensions (score 0-100 each):

**Profile:**
- Monthly Income: ₹{monthly_income:,.0f}
- Monthly Expenses: ₹{monthly_expenses:,.0f}
- Emergency Fund: ₹{emergency_fund:,.0f} ({emergency_months:.1f} months covered)
- Life Insurance: {has_life_insurance} (Sum: ₹{life_cover:,.0f})
- Health Insurance: {has_health_insurance} (Sum: ₹{health_cover:,.0f})
- Total Investments: ₹{total_investments:,.0f}
- Investment Breakdown: {investment_breakdown}
- Total Debt EMI: ₹{total_emi:,.0f}
- Debt-to-Income Ratio: {debt_ratio:.1f}%
- Tax Regime: {tax_regime}
- Risk Profile: {risk_profile}

**Score these dimensions:**
1. Emergency Preparedness (target: 6 months expenses)
2. Insurance Coverage (life: 10x income, health: ₹10L+ floater)
3. Investment Diversification (across equity/debt/gold)
4. Debt Health (EMI < 40% income, no high-interest debt)
5. Tax Efficiency (max 80C, 80D, NPS utilization)
6. Retirement Readiness (on track for 25x expenses corpus)

Respond in JSON: overall_score, dimensions (each with score, status, details, actions), 
ai_summary, top_3_actions (priority, action, impact, category)"""

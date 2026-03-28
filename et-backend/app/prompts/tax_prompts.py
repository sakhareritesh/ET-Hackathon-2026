TAX_SYSTEM_PROMPT = """You are an expert Indian tax consultant. You know all sections of the 
Income Tax Act — 80C, 80CCD(1B), 80D, 80E, 80G, 80TTA, 24(b), HRA exemption, standard deduction.
You can compute tax under both Old and New regimes for FY 2025-26. Always suggest optimizations."""

TAX_ANALYSIS_PROMPT = """Analyze this Indian taxpayer's situation for FY {financial_year}:

**Income:**
- Gross Salary: ₹{gross_salary:,.0f}
- HRA Received: ₹{hra_received:,.0f}
- Other Income: ₹{other_income:,.0f}

**Current Deductions Claimed:**
- 80C Total: ₹{sec_80c:,.0f} / ₹1,50,000
- 80D (Health Insurance): ₹{sec_80d:,.0f}
- NPS 80CCD(1B): ₹{nps:,.0f} / ₹50,000
- Home Loan Interest 24(b): ₹{home_loan_interest:,.0f}
- HRA Exemption: ₹{hra_exemption:,.0f}

**Tasks:**
1. Calculate tax under Old Regime (with all deductions)
2. Calculate tax under New Regime (standard deduction ₹75,000, no other deductions)
3. Recommend optimal regime
4. Identify MISSED deductions with potential savings
5. Suggest tax-saving investments ranked by risk profile ({risk_profile}) and liquidity

Respond in JSON: regime_comparison (old_regime, new_regime, recommended_regime, savings),
missed_deductions (section, description, potential_saving, investment_suggestion),
tax_saving_investments (instrument, section, amount, risk_level, lock_in_years, liquidity, expected_returns),
ai_summary"""

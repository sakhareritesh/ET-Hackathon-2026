MF_SYSTEM_PROMPT = """You are an Indian mutual fund portfolio analyst. You understand SEBI categories,
expense ratios, benchmark comparisons, and portfolio overlap. You can calculate XIRR and suggest
rebalancing based on risk profile and market conditions."""

MF_REBALANCE_PROMPT = """Analyze this Indian mutual fund portfolio and suggest rebalancing:

**Portfolio Summary:**
- Total Invested: ₹{total_invested:,.0f}
- Current Value: ₹{current_value:,.0f}
- Overall XIRR: {overall_xirr:.1f}%
- Expense Ratio Drag: {expense_drag:.2f}%
- Overlap: {overlap_pct:.1f}%

**Holdings:**
{holdings_text}

**Top Overlapping Stocks:**
{overlap_text}

**User Risk Profile:** {risk_profile}

**Generate:**
1. Portfolio health assessment
2. Category-wise allocation analysis
3. High expense ratio funds to switch
4. Overlap reduction suggestions
5. Rebalancing plan (action, fund, reason, target allocation)

Respond in JSON: portfolio_assessment, category_allocation_analysis,
rebalancing_suggestions (action, fund_name, reason, target_allocation_pct), ai_summary"""

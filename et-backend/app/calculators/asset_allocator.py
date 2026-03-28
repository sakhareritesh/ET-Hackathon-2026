def get_allocation_by_age(age: int, risk_profile: str = "moderate") -> dict:
    """Get recommended asset allocation based on age and risk profile.
    
    Uses the rule of thumb: Equity % = 100 - Age (adjusted by risk profile).
    """
    base_equity = max(100 - age, 20)

    risk_adjustments = {
        "conservative": -15,
        "moderate": 0,
        "aggressive": 10,
        "very_aggressive": 20,
    }

    adjustment = risk_adjustments.get(risk_profile, 0)
    equity = min(max(base_equity + adjustment, 10), 90)
    debt = max(100 - equity - 10, 5)
    gold = min(10, 100 - equity - debt)
    cash = 100 - equity - debt - gold

    return {
        "equity": round(equity, 1),
        "debt": round(debt, 1),
        "gold": round(gold, 1),
        "cash": round(max(cash, 0), 1),
    }

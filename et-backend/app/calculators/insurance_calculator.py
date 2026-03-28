def calculate_compound_interest(
    principal: float,
    annual_rate: float,
    years: int,
    compounding: str = "yearly",
) -> dict:
    """Calculate compound interest with different compounding frequencies."""
    freq_map = {"monthly": 12, "quarterly": 4, "half_yearly": 2, "yearly": 1}
    n = freq_map.get(compounding, 1)
    r = annual_rate / 100

    amount = principal * ((1 + r / n) ** (n * years))
    interest = amount - principal

    return {
        "principal": round(principal, 2),
        "interest_earned": round(interest, 2),
        "maturity_amount": round(amount, 2),
        "effective_annual_rate": round(((1 + r / n) ** n - 1) * 100, 2),
    }


def calculate_insurance_need(
    annual_income: float,
    age: int,
    outstanding_debts: float = 0,
    dependents: int = 1,
) -> dict:
    """Calculate recommended life insurance cover."""
    income_replacement = annual_income * max(60 - age, 10)
    debt_cover = outstanding_debts
    child_education = dependents * 2500000  # ₹25L per child
    total_need = income_replacement + debt_cover + child_education

    return {
        "recommended_cover": round(total_need, 0),
        "income_replacement": round(income_replacement, 0),
        "debt_cover": round(debt_cover, 0),
        "child_education_fund": round(child_education, 0),
    }

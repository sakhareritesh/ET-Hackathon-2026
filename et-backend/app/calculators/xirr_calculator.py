from datetime import date
from typing import Optional


def calculate_xirr(transactions: list[dict], current_value: float, as_of: Optional[date] = None) -> float:
    """Calculate XIRR (Extended Internal Rate of Return) for mutual fund investments.
    
    Uses Newton-Raphson method to solve for the rate r in:
    sum(cashflow_i / (1+r)^((date_i - date_0)/365)) = 0
    """
    if not transactions:
        return 0.0

    if as_of is None:
        as_of = date.today()

    # Build cashflows: negative for purchases, positive for redemptions
    cashflows = []
    for txn in transactions:
        txn_date = txn.get("date")
        if isinstance(txn_date, str):
            txn_date = date.fromisoformat(txn_date)

        amount = txn.get("amount", 0)
        txn_type = txn.get("type", "purchase")

        if txn_type in ("purchase", "switch_in"):
            cashflows.append((-abs(amount), txn_date))
        elif txn_type in ("redemption", "switch_out", "dividend"):
            cashflows.append((abs(amount), txn_date))

    # Add current value as final positive cashflow
    cashflows.append((current_value, as_of))

    if len(cashflows) < 2:
        return 0.0

    # Newton-Raphson
    def xnpv(rate, cashflows):
        t0 = cashflows[0][1]
        return sum(cf / ((1 + rate) ** ((dt - t0).days / 365.0)) for cf, dt in cashflows)

    def xnpv_derivative(rate, cashflows):
        t0 = cashflows[0][1]
        return sum(
            -cf * ((dt - t0).days / 365.0) / ((1 + rate) ** ((dt - t0).days / 365.0 + 1))
            for cf, dt in cashflows
        )

    rate = 0.1  # Initial guess
    for _ in range(100):
        npv = xnpv(rate, cashflows)
        dnpv = xnpv_derivative(rate, cashflows)
        if abs(dnpv) < 1e-12:
            break
        new_rate = rate - npv / dnpv
        if abs(new_rate - rate) < 1e-8:
            break
        rate = new_rate

    return round(rate * 100, 2)  # Return as percentage

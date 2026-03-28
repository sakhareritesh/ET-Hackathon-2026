def calculate_sip(target: float, years: int, annual_return: float = 12.0) -> float:
    """Calculate monthly SIP needed to reach a target amount.
    
    Uses future value of annuity formula:
    FV = PMT * [((1+r)^n - 1) / r]
    PMT = FV * r / ((1+r)^n - 1)
    """
    if years <= 0 or target <= 0:
        return 0

    monthly_rate = annual_return / 100 / 12
    months = years * 12

    if monthly_rate == 0:
        return target / months

    sip = target * monthly_rate / (((1 + monthly_rate) ** months) - 1)
    return round(sip, 2)


def calculate_future_value(sip: float, years: int, annual_return: float = 12.0) -> float:
    """Calculate future value of monthly SIP investments."""
    monthly_rate = annual_return / 100 / 12
    months = years * 12

    if monthly_rate == 0:
        return sip * months

    fv = sip * (((1 + monthly_rate) ** months - 1) / monthly_rate)
    return round(fv, 2)


def calculate_lumpsum_future_value(principal: float, years: int, annual_return: float = 12.0) -> float:
    """Calculate future value of a lumpsum investment."""
    return round(principal * ((1 + annual_return / 100) ** years), 2)

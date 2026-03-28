def calculate_tax_old(
    gross_salary: float,
    hra_exemption: float = 0,
    standard_deduction: float = 50000,
    sec_80c: float = 0,
    sec_80d: float = 0,
    nps: float = 0,
    home_loan_interest: float = 0,
    other_deductions: float = 0,
) -> dict:
    """Calculate income tax under Old Regime (FY 2025-26)."""
    taxable = gross_salary
    taxable -= min(hra_exemption, gross_salary * 0.5)
    taxable -= standard_deduction
    taxable -= min(sec_80c, 150000)
    taxable -= min(sec_80d, 100000)
    taxable -= min(nps, 50000)
    taxable -= min(home_loan_interest, 200000)
    taxable -= other_deductions
    taxable = max(taxable, 0)

    # Old regime slabs FY 2025-26
    tax = 0
    if taxable > 1000000:
        tax += (taxable - 1000000) * 0.30
        taxable = 1000000
    if taxable > 500000:
        tax += (taxable - 500000) * 0.20
        taxable = 500000
    if taxable > 250000:
        tax += (taxable - 250000) * 0.05

    # Rebate u/s 87A
    if (gross_salary - standard_deduction - min(sec_80c, 150000) - min(sec_80d, 100000)) <= 500000:
        tax = 0

    cess = tax * 0.04
    return {
        "taxable_income": max(gross_salary - standard_deduction - min(sec_80c, 150000) - min(sec_80d, 100000) - min(nps, 50000) - min(home_loan_interest, 200000) - other_deductions - min(hra_exemption, gross_salary * 0.5), 0),
        "tax_payable": round(tax, 2),
        "cess": round(cess, 2),
        "total_tax": round(tax + cess, 2),
    }


def calculate_tax_new(gross_salary: float) -> dict:
    """Calculate income tax under New Regime (FY 2025-26).
    
    New regime slabs (Budget 2025):
    0 - 4L: Nil  
    4L - 8L: 5%
    8L - 12L: 10%
    12L - 16L: 15%
    16L - 20L: 20%
    20L - 24L: 25%
    Above 24L: 30%
    Standard deduction: ₹75,000
    """
    taxable = max(gross_salary - 75000, 0)  # Standard deduction in new regime

    slabs = [
        (400000, 0.00),
        (400000, 0.05),
        (400000, 0.10),
        (400000, 0.15),
        (400000, 0.20),
        (400000, 0.25),
        (float("inf"), 0.30),
    ]

    tax = 0
    remaining = taxable
    for slab_limit, rate in slabs:
        if remaining <= 0:
            break
        taxable_in_slab = min(remaining, slab_limit)
        tax += taxable_in_slab * rate
        remaining -= taxable_in_slab

    # Rebate u/s 87A (up to ₹12L taxable income in new regime)
    if taxable <= 1200000:
        tax = 0

    cess = tax * 0.04
    return {
        "taxable_income": taxable,
        "tax_payable": round(tax, 2),
        "cess": round(cess, 2),
        "total_tax": round(tax + cess, 2),
    }

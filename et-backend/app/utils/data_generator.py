"""
Demo profile seed data for DhanGuru / ET Hackathon tooling.
Use `get_demo_profiles()` for full JSON-serializable profile dicts
and `get_demo_mf_holdings(profile_name)` for MF X-Ray style holdings.
"""

from __future__ import annotations

import json
from typing import Any


def get_demo_profiles() -> list[dict[str, Any]]:
    """Return three realistic Indian demo profiles as plain dicts (JSON-serializable)."""
    return [
        _profile_rahul_sharma(),
        _profile_priya_iyer_couple(),
        _profile_suresh_patel(),
    ]


def get_demo_mf_holdings(profile_name: str) -> list[dict[str, Any]]:
    """
    MF X-Ray demo holdings for a named profile.
    Keys align with frontend / API holding rows: fund_name, category,
    invested_amount, current_value, expense_ratio, optional xirr.
    """
    key = profile_name.strip().lower()
    if key in ("rahul sharma", "rahul"):
        return [
            {
                "fund_name": "Axis Bluechip Fund",
                "category": "Large Cap",
                "invested_amount": 300_000,
                "current_value": 342_000,
                "expense_ratio": 1.05,
                "xirr": 12.4,
            },
            {
                "fund_name": "Mirae Asset Large Cap Fund",
                "category": "Large Cap",
                "invested_amount": 200_000,
                "current_value": 228_500,
                "expense_ratio": 0.98,
                "xirr": 11.9,
            },
        ]
    if key in ("priya iyer", "priya", "arjun iyer", "couple"):
        return [
            {
                "fund_name": "Parag Parikh Flexi Cap Fund",
                "category": "Flexi Cap",
                "invested_amount": 400_000,
                "current_value": 468_000,
                "expense_ratio": 0.65,
                "xirr": 13.1,
            },
            {
                "fund_name": "Axis Midcap Fund",
                "category": "Mid Cap",
                "invested_amount": 350_000,
                "current_value": 401_200,
                "expense_ratio": 1.02,
                "xirr": 12.0,
            },
            {
                "fund_name": "HDFC Corporate Bond Fund",
                "category": "Debt",
                "invested_amount": 250_000,
                "current_value": 263_800,
                "expense_ratio": 0.60,
                "xirr": 7.2,
            },
            {
                "fund_name": "Nippon India Large Cap Fund",
                "category": "Large Cap",
                "invested_amount": 200_000,
                "current_value": 224_400,
                "expense_ratio": 1.04,
                "xirr": 10.8,
            },
        ]
    if key in ("suresh patel", "suresh"):
        return [
            {
                "fund_name": "Axis Bluechip Fund",
                "category": "Large Cap",
                "invested_amount": 500_000,
                "current_value": 562_000,
                "expense_ratio": 1.05,
                "xirr": 11.2,
            },
            {
                "fund_name": "Mirae Asset Large Cap Fund",
                "category": "Large Cap",
                "invested_amount": 400_000,
                "current_value": 446_800,
                "expense_ratio": 0.98,
                "xirr": 10.9,
            },
            {
                "fund_name": "SBI Small Cap Fund",
                "category": "Small Cap",
                "invested_amount": 300_000,
                "current_value": 388_500,
                "expense_ratio": 1.05,
                "xirr": 14.5,
            },
            {
                "fund_name": "HDFC Mid Cap Opportunities Fund",
                "category": "Mid Cap",
                "invested_amount": 400_000,
                "current_value": 455_200,
                "expense_ratio": 1.08,
                "xirr": 12.8,
            },
            {
                "fund_name": "Parag Parikh Flexi Cap Fund",
                "category": "Flexi Cap",
                "invested_amount": 600_000,
                "current_value": 702_000,
                "expense_ratio": 0.65,
                "xirr": 13.4,
            },
        ]
    return []


def _profile_rahul_sharma() -> dict[str, Any]:
    return {
        "id": "demo_rahul_sharma",
        "name": "Rahul Sharma",
        "persona": "Young Professional",
        "age": 28,
        "city": "Mumbai",
        "is_metro": True,
        "marital_status": "single",
        "dependents": 0,
        "retirement_age": 50,
        "risk_profile": "moderate",
        "tax_regime": "new",
        "employment_type": "salaried",
        "annual_income": {
            "gross": 1_500_000,
            "net": 1_080_000,
        },
        "salary_structure": {
            "basic": 600_000,
            "hra": 300_000,
            "special_allowance": 600_000,
        },
        "monthly_expenses": {
            "rent": 18_000,
            "groceries": 8_000,
            "utilities": 3_500,
            "transport": 4_500,
            "entertainment": 4_000,
            "other": 2_000,
            "total": 40_000,
        },
        "existing_investments": {
            "ppf": 150_000,
            "epf": 90_000,
            "nps": 0,
            "elss": 0,
            "fd": 0,
            "stocks": 0,
            "mutual_funds": 500_000,
            "real_estate": 0,
            "gold": 0,
            "crypto": 0,
            "other": 0,
        },
        "debts": [],
        "insurance": {
            "life": {"has_cover": False, "sum_assured": 0, "premium": 0},
            "health": {
                "has_cover": False,
                "sum_assured": 0,
                "premium": 0,
                "family_floater": False,
            },
        },
        "emergency_fund": {"current_amount": 120_000, "months_covered": 1.0},
        "tax_deductions": {
            "section_80c": 150_000,
            "section_80d": 0,
            "nps_80ccd_1b": 0,
        },
        "goals": [
            {
                "name": "Emergency fund (6 months)",
                "target_amount": 240_000,
                "target_date": "2026-12-31",
                "priority": "high",
            },
            {
                "name": "House purchase — down payment",
                "target_amount": 8_000_000,
                "target_date": "2032-03-31",
                "priority": "high",
            },
        ],
        "notes": "No term or health insurance; strong 80C via PPF; MF overlap risk between two large-cap funds.",
    }


def _profile_priya_iyer_couple() -> dict[str, Any]:
    return {
        "id": "demo_priya_arjun_iyer",
        "primary": {
            "name": "Priya Iyer",
            "age": 32,
            "employment_type": "salaried",
            "annual_income": {"gross": 1_600_000, "net": 1_150_000},
            "salary_structure": {"basic": 640_000, "hra": 320_000},
        },
        "spouse": {
            "name": "Arjun Iyer",
            "age": 34,
            "employment_type": "salaried",
            "annual_income": {"gross": 1_200_000, "net": 880_000},
            "salary_structure": {"basic": 480_000, "hra": 240_000},
        },
        "name": "Priya Iyer",
        "persona": "Dual-income couple",
        "age": 32,
        "city": "Bengaluru",
        "is_metro": True,
        "marital_status": "married",
        "dependents": 0,
        "risk_profile": "moderate",
        "tax_regime": "new",
        "monthly_expenses": {
            "rent": 22_000,
            "groceries": 18_000,
            "utilities": 6_000,
            "transport": 10_000,
            "entertainment": 8_000,
            "other": 11_000,
            "total": 75_000,
        },
        "combined_annual_income_gross": 2_800_000,
        "existing_investments": {
            "ppf": 300_000,
            "epf": 420_000,
            "mutual_funds": 480_000,
            "fd": 0,
            "stocks": 0,
            "nps": 0,
            "elss": 0,
            "real_estate": 0,
            "gold": 50_000,
            "crypto": 0,
            "other": 0,
        },
        "debts": [],
        "insurance": {
            "life": {
                "priya": {"has_cover": False, "sum_assured": 0},
                "arjun": {"has_cover": False, "sum_assured": 0},
            },
            "health": {
                "has_cover": True,
                "sum_assured_each": 500_000,
                "family_floater": False,
                "combined_cover_note": "₹5 lakh individual cover each",
                "premium_annual": 24_000,
            },
        },
        "emergency_fund": {"current_amount": 450_000, "months_covered": 6.0},
        "goals": [
            {
                "name": "International vacation",
                "target_amount": 600_000,
                "target_date": "2027-06-01",
                "priority": "medium",
            },
            {
                "name": "Child education fund (future)",
                "target_amount": 2_000_000,
                "target_date": "2035-04-01",
                "priority": "medium",
            },
        ],
        "notes": "Combined investable surplus healthy; term life missing for both earners despite mortgage-free rent.",
    }


def _profile_suresh_patel() -> dict[str, Any]:
    return {
        "id": "demo_suresh_patel",
        "name": "Suresh Patel",
        "persona": "Mid-career professional",
        "age": 40,
        "city": "Delhi",
        "is_metro": True,
        "marital_status": "married",
        "dependents": 2,
        "retirement_age": 55,
        "risk_profile": "moderate",
        "tax_regime": "old",
        "employment_type": "salaried",
        "annual_income": {
            "gross": 2_500_000,
            "net": 1_720_000,
        },
        "salary_structure": {
            "basic": 1_000_000,
            "hra": 500_000,
            "special_allowance": 1_000_000,
        },
        "monthly_expenses": {
            "rent": 35_000,
            "groceries": 18_000,
            "utilities": 8_000,
            "education": 12_000,
            "transport": 4_000,
            "entertainment": 3_000,
            "total": 80_000,
        },
        "existing_investments": {
            "ppf": 1_200_000,
            "epf": 850_000,
            "nps": 0,
            "elss": 150_000,
            "fd": 400_000,
            "stocks": 200_000,
            "mutual_funds": 2_200_000,
            "real_estate": 0,
            "gold": 150_000,
            "crypto": 0,
            "other": 0,
        },
        "debts": [{"type": "car_loan", "outstanding": 280_000, "emi": 12_000}],
        "insurance": {
            "life": {"has_cover": True, "sum_assured": 10_000_000, "premium": 18_000},
            "health": {
                "has_cover": True,
                "sum_assured": 1_000_000,
                "premium": 28_000,
                "family_floater": True,
            },
        },
        "emergency_fund": {"current_amount": 480_000, "months_covered": 6.0},
        "tax_deductions": {
            "section_80c": 150_000,
            "section_80d": 25_000,
            "nps_80ccd_1b": 0,
        },
        "goals": [
            {
                "name": "Children higher education",
                "target_amount": 40_00_000,
                "target_date": "2030-06-01",
                "priority": "high",
            },
            {
                "name": "Retirement corpus top-up",
                "target_amount": 2_00_00_000,
                "target_date": "2040-03-31",
                "priority": "high",
            },
        ],
        "notes": "Large-cap overlap across Axis and Mirae; consider consolidating; ELSS and PPF max 80C.",
    }


def demo_profiles_json() -> str:
    """Pretty-printed JSON string of all demo profiles (for CLI or tests)."""
    return json.dumps(get_demo_profiles(), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    print(demo_profiles_json())

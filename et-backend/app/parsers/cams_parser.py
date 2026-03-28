"""Parse CAMS / KFintech mutual fund statement CSV data.

Extracts fund holdings, transaction history, and computes per-fund metrics.
"""

import re
from datetime import date
from typing import Optional


def parse_cams_csv(rows: list[dict]) -> dict:
    """Parse CSV rows from CAMS/KFintech statement into structured holdings.

    Expected CSV columns (flexible matching):
    - Fund/Scheme Name
    - Date / Transaction Date
    - Amount
    - Units
    - NAV / Price
    - Transaction Type (Purchase/Redemption/Switch In/Switch Out/Dividend)
    """
    funds: dict[str, dict] = {}

    for row in rows:
        fund_name = _get_field(row, ["scheme", "fund", "scheme_name", "fund_name", "mutual_fund"])
        if not fund_name:
            continue

        if fund_name not in funds:
            funds[fund_name] = {
                "fund_name": fund_name,
                "category": _infer_category(fund_name),
                "transactions": [],
                "total_invested": 0,
                "total_redeemed": 0,
                "units": 0,
                "latest_nav": 0,
            }

        txn_date = _parse_date(_get_field(row, ["date", "transaction_date", "txn_date", "nav_date"]))
        amount = _parse_float(_get_field(row, ["amount", "value", "transaction_amount"]))
        units = _parse_float(_get_field(row, ["units", "unit", "no_of_units"]))
        nav = _parse_float(_get_field(row, ["nav", "price", "nav_price"]))
        txn_type = (_get_field(row, ["type", "transaction_type", "txn_type", "description"]) or "purchase").lower()

        is_purchase = any(k in txn_type for k in ["purchase", "sip", "switch in", "additional"])
        is_redemption = any(k in txn_type for k in ["redemption", "switch out", "withdrawal"])

        if is_purchase:
            funds[fund_name]["total_invested"] += abs(amount)
            funds[fund_name]["units"] += abs(units)
            funds[fund_name]["transactions"].append({
                "date": txn_date,
                "amount": abs(amount),
                "type": "purchase",
            })
        elif is_redemption:
            funds[fund_name]["total_redeemed"] += abs(amount)
            funds[fund_name]["units"] -= abs(units)
            funds[fund_name]["transactions"].append({
                "date": txn_date,
                "amount": abs(amount),
                "type": "redemption",
            })

        if nav > 0:
            funds[fund_name]["latest_nav"] = nav

    holdings = []
    for name, data in funds.items():
        current_value = data["units"] * data["latest_nav"] if data["latest_nav"] > 0 else data["total_invested"]
        invested = data["total_invested"] - data["total_redeemed"]

        holdings.append({
            "fund_name": name,
            "category": data["category"],
            "invested_amount": round(max(invested, 0), 2),
            "current_value": round(max(current_value, 0), 2),
            "units": round(data["units"], 4),
            "latest_nav": data["latest_nav"],
            "expense_ratio": _estimate_expense_ratio(data["category"]),
            "transactions": data["transactions"],
        })

    total_invested = sum(h["invested_amount"] for h in holdings)
    total_current = sum(h["current_value"] for h in holdings)

    return {
        "holdings": holdings,
        "summary": {
            "total_invested": round(total_invested, 2),
            "total_current_value": round(total_current, 2),
            "total_returns": round(total_current - total_invested, 2),
            "returns_pct": round((total_current / max(total_invested, 1) - 1) * 100, 2),
            "num_funds": len(holdings),
        },
    }


def _get_field(row: dict, candidates: list[str]) -> Optional[str]:
    for key in row:
        normalized = key.lower().strip().replace(" ", "_")
        for candidate in candidates:
            if candidate in normalized:
                return str(row[key]).strip()
    return None


def _parse_date(val: Optional[str]) -> str:
    if not val:
        return date.today().isoformat()
    for fmt in ["%d-%b-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d %b %Y"]:
        try:
            from datetime import datetime
            return datetime.strptime(val.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return date.today().isoformat()


def _parse_float(val: Optional[str]) -> float:
    if not val:
        return 0.0
    try:
        return float(str(val).replace(",", "").strip())
    except ValueError:
        return 0.0


def _infer_category(fund_name: str) -> str:
    name = fund_name.lower()
    if any(k in name for k in ["liquid", "overnight", "money market"]):
        return "Liquid"
    if any(k in name for k in ["small cap", "smallcap"]):
        return "Small Cap"
    if any(k in name for k in ["mid cap", "midcap"]):
        return "Mid Cap"
    if any(k in name for k in ["large cap", "largecap", "bluechip", "large & mid"]):
        return "Large Cap"
    if any(k in name for k in ["flexi", "multi cap", "multicap"]):
        return "Flexi Cap"
    if any(k in name for k in ["index", "nifty", "sensex"]):
        return "Index"
    if any(k in name for k in ["elss", "tax"]):
        return "ELSS"
    if any(k in name for k in ["debt", "bond", "gilt", "corporate"]):
        return "Debt"
    if any(k in name for k in ["hybrid", "balanced", "aggressive"]):
        return "Hybrid"
    return "Equity"


def _estimate_expense_ratio(category: str) -> float:
    ratios = {
        "Index": 0.15, "Liquid": 0.20, "Debt": 0.40,
        "Large Cap": 0.80, "Flexi Cap": 0.90, "Mid Cap": 1.00,
        "Small Cap": 1.20, "ELSS": 0.85, "Hybrid": 0.90, "Equity": 0.90,
    }
    return ratios.get(category, 0.90)

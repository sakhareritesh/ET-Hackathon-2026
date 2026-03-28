"""Parse Form 16 text content into structured salary and deduction data.

Handles common patterns in Indian Form 16 PDFs (text extracted by frontend).
Uses regex patterns matched against typical Form 16 layouts.
"""

import re
from typing import Optional


def parse_form16_text(text: str) -> dict:
    """Extract financial data from raw Form 16 text."""
    result = {
        "gross_salary": _extract_amount(text, [
            r"gross\s*(?:total\s*)?(?:salary|income)[^\d]*?([\d,]+(?:\.\d+)?)",
            r"total\s*(?:gross\s*)?salary[^\d]*?([\d,]+(?:\.\d+)?)",
            r"income\s*chargeable\s*under.*?salary[^\d]*?([\d,]+(?:\.\d+)?)",
        ]),
        "basic_salary": _extract_amount(text, [
            r"basic\s*(?:salary|pay)[^\d]*?([\d,]+(?:\.\d+)?)",
        ]),
        "hra_received": _extract_amount(text, [
            r"(?:house\s*rent|hra)[^\d]*?([\d,]+(?:\.\d+)?)",
        ]),
        "standard_deduction": _extract_amount(text, [
            r"standard\s*deduction[^\d]*?([\d,]+(?:\.\d+)?)",
        ]) or 50000,
        "section_80c": _extract_amount(text, [
            r"(?:section\s*)?80\s*c[^\d]*?([\d,]+(?:\.\d+)?)",
            r"chapter\s*vi[\-\s]*a.*?80c[^\d]*?([\d,]+(?:\.\d+)?)",
        ]),
        "section_80d": _extract_amount(text, [
            r"(?:section\s*)?80\s*d[^\d]*?([\d,]+(?:\.\d+)?)",
        ]),
        "nps_80ccd": _extract_amount(text, [
            r"(?:section\s*)?80\s*ccd[^\d]*?([\d,]+(?:\.\d+)?)",
            r"nps[^\d]*?([\d,]+(?:\.\d+)?)",
        ]),
        "home_loan_interest": _extract_amount(text, [
            r"(?:section\s*)?24\s*(?:\(b\)|b)[^\d]*?([\d,]+(?:\.\d+)?)",
            r"interest\s*on\s*(?:housing|home)\s*loan[^\d]*?([\d,]+(?:\.\d+)?)",
        ]),
        "total_tax_deducted": _extract_amount(text, [
            r"total\s*(?:tax\s*)?(?:deducted|tds)[^\d]*?([\d,]+(?:\.\d+)?)",
        ]),
        "employer_name": _extract_text(text, [
            r"name\s*(?:and\s*address\s*)?of\s*(?:the\s*)?(?:employer|deductor)[:\s]*([A-Za-z\s&.,]+?)(?:\n|$)",
        ]),
        "pan": _extract_text(text, [
            r"(?:employee['s]*\s*)?pan\s*(?:no\.?)?[:\s]*([A-Z]{5}\d{4}[A-Z])",
        ]),
        "financial_year": _extract_text(text, [
            r"(?:financial\s*year|fy|assessment\s*year)[:\s]*(\d{4}[\-–]\d{2,4})",
        ]),
        "parse_confidence": "medium",
    }

    if result["gross_salary"] and result["gross_salary"] > 100000:
        result["parse_confidence"] = "high"
    elif not result["gross_salary"]:
        result["parse_confidence"] = "low"

    return result


def _extract_amount(text: str, patterns: list[str]) -> Optional[float]:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                val = match.group(1).replace(",", "").strip()
                return float(val)
            except (ValueError, IndexError):
                continue
    return 0


def _extract_text(text: str, patterns: list[str]) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None

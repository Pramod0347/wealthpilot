from decimal import Decimal

# Review these rules at the start of every financial year. This file is config-driven
# on purpose so the calculation logic can stay stable while yearly thresholds change.

NEW_REGIME_FINANCIAL_YEAR = "2025-26"
NEW_REGIME_ASSESSMENT_YEAR = "2026-27"
NEW_REGIME_STANDARD_DEDUCTION = Decimal("75000")
NEW_REGIME_REBATE_LIMIT = Decimal("1200000")
CESS_RATE = Decimal("0.04")

NEW_REGIME_SLABS = (
    (Decimal("400000"), Decimal("0.00")),
    (Decimal("800000"), Decimal("0.05")),
    (Decimal("1200000"), Decimal("0.10")),
    (Decimal("1600000"), Decimal("0.15")),
    (Decimal("2000000"), Decimal("0.20")),
    (Decimal("2400000"), Decimal("0.25")),
    (None, Decimal("0.30")),
)

ALLOWED_NEW_REGIME_DEDUCTION_SECTIONS = {"NPS_EMPLOYER", "OTHER_ALLOWED"}

BASE_REQUIRED_DOCUMENTS = (
    ("FORM_16", "Form 16"),
    ("AIS", "AIS"),
    ("TIS", "TIS"),
    ("FORM_26AS", "Form 26AS"),
    ("BANK_INTEREST_CERTIFICATE", "Bank Interest Certificate"),
)

INCOME_DOCUMENT_REQUIREMENTS = {
    "capital_gains": (("CAPITAL_GAINS_STATEMENT", "Capital Gains Statement"),),
}

from decimal import Decimal, ROUND_HALF_UP


def to_decimal(value: str | int | float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def format_inr(value: Decimal | int | float) -> str:
    amount = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"₹{amount:,.2f}"

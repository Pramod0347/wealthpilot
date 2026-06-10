from decimal import Decimal


def calculate_invested_amount(quantity: Decimal, avg_buy_price: Decimal) -> Decimal:
    return quantity * avg_buy_price


def calculate_current_value(quantity: Decimal, current_price: Decimal) -> Decimal:
    return quantity * current_price


def calculate_pnl(current_value: Decimal, invested_amount: Decimal) -> Decimal:
    return current_value - invested_amount


def calculate_return_pct(pnl: Decimal, invested_amount: Decimal) -> Decimal:
    if invested_amount == 0:
        return Decimal("0")
    return (pnl / invested_amount) * Decimal("100")


def calculate_available_limit(total_limit: Decimal, used_amount: Decimal) -> Decimal:
    return total_limit - used_amount


def calculate_utilization_pct(used_amount: Decimal, total_limit: Decimal) -> Decimal:
    if total_limit == 0:
        return Decimal("0")
    return (used_amount / total_limit) * Decimal("100")

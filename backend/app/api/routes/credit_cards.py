from fastapi import APIRouter

router = APIRouter(prefix="/credit-cards", tags=["credit-cards"])


@router.get("")
def list_credit_cards() -> list[dict[str, object]]:
    return []


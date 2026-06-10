from fastapi import APIRouter

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("")
def list_transactions() -> list[dict[str, object]]:
    return []


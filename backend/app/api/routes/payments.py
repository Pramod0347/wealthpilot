from fastapi import APIRouter

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/upcoming")
def list_upcoming_payments() -> list[dict[str, object]]:
    return []


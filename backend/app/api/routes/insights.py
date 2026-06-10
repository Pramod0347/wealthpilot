from fastapi import APIRouter

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("")
def list_insights() -> list[dict[str, object]]:
    return []


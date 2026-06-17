from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.session import verify_session_token


def require_auth(request: Request) -> None:
    token = request.cookies.get("wp_session")
    if not token or not verify_session_token(token, settings.secret_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

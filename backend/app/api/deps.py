from fastapi import HTTPException, Request, status

from app.core.config import auth_bypass_enabled, settings
from app.core.session import verify_session_token


def get_request_auth_token(request: Request) -> str | None:
    cookie_token = request.cookies.get("wp_session")
    if cookie_token:
        return cookie_token

    authorization = request.headers.get("Authorization", "").strip()
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        return token or None

    return None


def require_auth(request: Request) -> None:
    if auth_bypass_enabled():
        return

    token = get_request_auth_token(request)
    if not token or not verify_session_token(token, settings.secret_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

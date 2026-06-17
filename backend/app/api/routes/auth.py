from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.session import create_session_token, verify_session_token

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_NAME = "wp_session"
_SESSION_DAYS = 7


def _production() -> bool:
    return settings.app_env == "production"


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=_production(),
        samesite="none" if _production() else "lax",
        max_age=_SESSION_DAYS * 24 * 3600,
        path="/",
    )


def _clear_cookie(response: Response) -> None:
    response.delete_cookie(
        key=_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=_production(),
        samesite="none" if _production() else "lax",
    )


def _digits_only(value: str) -> str:
    return "".join(c for c in value if c.isdigit())


class LoginRequest(BaseModel):
    email: str
    phone: str


@router.post("/login")
def login(body: LoginRequest, response: Response) -> dict:
    if not settings.owner_email or not settings.owner_phone:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Owner credentials are not configured on the server.",
        )
    if not settings.secret_key or settings.secret_key.startswith("changeme"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SECRET_KEY is not configured.",
        )

    email_ok = body.email.strip().lower() == settings.owner_email.strip().lower()
    phone_ok = _digits_only(body.phone) == _digits_only(settings.owner_phone)

    if not email_ok or not phone_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    token = create_session_token(settings.secret_key, _SESSION_DAYS)
    _set_cookie(response, token)
    return {"authenticated": True}


@router.get("/me")
def me(request: Request) -> dict:
    token = request.cookies.get(_COOKIE_NAME)
    if token and settings.secret_key and verify_session_token(token, settings.secret_key):
        return {"authenticated": True}
    return {"authenticated": False}


@router.post("/logout")
def logout(response: Response) -> dict:
    _clear_cookie(response)
    return {"authenticated": False}

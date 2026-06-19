from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "WealthPilot API"
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/wealthpilot"
    # Comma-separated list of allowed frontend origins, e.g. "https://money.pramodgoudar.com"
    frontend_url: str = ""
    # Optional cookie overrides for production deployments.
    cookie_samesite: str = ""
    cookie_secure: str = ""
    cookie_domain: str = ""
    # Owner credentials — keep server-side only, never in frontend env vars
    owner_email: str = ""
    owner_phone: str = ""
    # HMAC signing key for session cookies — generate with: python -c "import secrets; print(secrets.token_hex(32))"
    secret_key: str = "changeme-use-secrets-token-hex-32-in-production"

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def normalize_database_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url

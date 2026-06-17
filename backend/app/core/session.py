import base64
import hashlib
import hmac
import json
import time


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (padding % 4))


def create_session_token(secret: str, exp_days: int = 7) -> str:
    payload = json.dumps({"auth": True, "exp": int(time.time()) + exp_days * 86400}).encode()
    payload_b64 = _b64encode(payload)
    mac = hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256)
    return f"{payload_b64}.{_b64encode(mac.digest())}"


def verify_session_token(token: str, secret: str) -> bool:
    try:
        payload_b64, sig_b64 = token.rsplit(".", 1)
        expected = hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64decode(sig_b64), expected):
            return False
        payload = json.loads(_b64decode(payload_b64))
        return int(payload.get("exp", 0)) > int(time.time())
    except Exception:
        return False

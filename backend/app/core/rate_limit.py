from __future__ import annotations

import jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

limiter = Limiter(key_func=get_remote_address)


def rate_limit_key_user_or_ip(request: Request) -> str:
    """Per-user key when a valid bearer token identifies the user, else client IP.

    This avoids trusting caller-supplied IDs while enabling per-user throttling for
    authenticated endpoints without breaking anonymous access.
    """
    auth = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        if token:
            try:
                from app.core.security import decode_token

                payload = decode_token(token)
                if payload.get("type") == "access" and payload.get("sub"):
                    return f"user:{payload['sub']}"
            except (jwt.PyJWTError, Exception):
                pass
    return f"ip:{get_remote_address(request)}"

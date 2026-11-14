from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException


class DomainError(Exception):
    def __init__(self, status: int, code: str, title: str, detail: str) -> None:
        self.status = status
        self.code = code
        self.title = title
        self.detail = detail


def problem(
    status: int, title: str, detail: str, code: str, request_id: str | None
) -> dict[str, Any]:
    return {
        "type": "about:blank",
        "title": title,
        "status": status,
        "detail": detail,
        "code": code,
        "request_id": request_id,
    }


def register_rate_limit_handler(app: FastAPI) -> None:
    """Return rate-limit rejections in the same problem-JSON shape as other errors.

    slowapi's default handler returns ``{"error": "..."}``, which is not the
    documented contract and gives clients no machine-readable code. This keeps
    429 responses consistent (``code``/``detail``/``request_id``) and adds a
    ``Retry-After`` header so a client can tell the user how long to wait.
    """

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> Response:
        rid = getattr(request.state, "request_id", None)
        limit = str(getattr(exc, "detail", "") or "").strip()
        detail = "Too many requests. Please wait a moment and try again."
        if limit:
            detail = f"Rate limit exceeded ({limit}). Please wait a moment and try again."
        response = JSONResponse(
            status_code=429,
            content=problem(429, "Too many requests", detail, "RATE_LIMITED", rid),
        )
        # Every limited route in this app uses a per-minute window.
        response.headers["Retry-After"] = "60"
        return response


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_handler(request: Request, exc: DomainError) -> JSONResponse:
        rid = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=exc.status,
            content=problem(exc.status, exc.title, exc.detail, exc.code, rid),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        rid = getattr(request.state, "request_id", None)
        detail = exc.detail if isinstance(exc.detail, str) else "HTTP error"
        code = "HTTP_ERROR"
        if exc.status_code == 404:
            code = "NOT_FOUND"
        elif exc.status_code == 403:
            code = "FORBIDDEN"
        elif exc.status_code == 401:
            code = "UNAUTHORIZED"
        return JSONResponse(
            status_code=exc.status_code,
            content=problem(exc.status_code, "HTTP error", detail, code, rid),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        rid = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=422,
            content=problem(
                422, "Validation error", "Request validation failed", "VALIDATION_ERROR", rid
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        rid = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=500,
            content=problem(
                500, "Internal Server Error", "An unexpected error occurred", "INTERNAL_ERROR", rid
            ),
        )

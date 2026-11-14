"""Optional LLM access.

Per `docs/02-TRD.md`, LLM use is behind an ``LLMClient`` interface, the output
is validated against a schema, and any failure falls back to the rule engine.
The LLM is **disabled by default** (``LLM_ENABLED=false``): the rule-based
answer path must work on its own.

Security notes:

* No tool calling, no network access and no function calling is exposed to the
  model. The client can only return text.
* The API key is never logged and never included in an error message.
* Timeouts are short and the response size is capped.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Protocol

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 20.0
MAX_OUTPUT_CHARS = 8000
# Provider base URLs. Any OpenAI-compatible /v1/chat/completions endpoint works.
PROVIDER_BASE_URLS = {
    "openai": "https://api.openai.com/v1",
    "openai_compatible": "https://api.openai.com/v1",
    "local": "http://localhost:11434/v1",
}


class LLMError(RuntimeError):
    """Raised when the LLM call fails or returns something unusable."""


class LLMClient(Protocol):
    async def complete(self, *, system: str, user: str) -> str:
        """Return raw model text. Raises :class:`LLMError` on failure."""
        ...


class HTTPChatLLMClient:
    """Minimal OpenAI-compatible chat-completions client."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout

    async def complete(self, *, system: str, user: str) -> str:
        payload = {
            "model": self._model,
            "temperature": 0,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }
        url = f"{self._base_url}/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            # Do not include the URL/headers/key in the message.
            raise LLMError(f"LLM request failed: {type(exc).__name__}") from None
        if resp.status_code >= 400:
            raise LLMError(f"LLM request failed with status {resp.status_code}")
        try:
            data: dict[str, Any] = resp.json()
            content = data["choices"][0]["message"]["content"]
        except Exception:
            raise LLMError("LLM response could not be parsed") from None
        if not isinstance(content, str) or not content.strip():
            raise LLMError("LLM returned an empty response")
        return content[:MAX_OUTPUT_CHARS]


def get_llm_client() -> LLMClient | None:
    """Return a configured client, or ``None`` when the LLM is disabled."""
    settings = get_settings()
    if not settings.llm_enabled:
        return None
    if not settings.llm_api_key:
        logger.warning("LLM_ENABLED is set but LLM_API_KEY is empty; using rule-based answers.")
        return None
    provider = (settings.llm_provider or "openai").strip().lower()
    base_url = PROVIDER_BASE_URLS.get(provider)
    if not base_url:
        logger.warning("Unknown LLM_PROVIDER '%s'; using rule-based answers.", provider)
        return None
    model = (settings.llm_model or "gpt-4o-mini").strip()
    return HTTPChatLLMClient(
        api_key=settings.llm_api_key,
        base_url=base_url,
        model=model,
    )


def extract_json_object(text: str) -> dict[str, Any]:
    """Parse a JSON object out of model text (tolerating code fences)."""
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1] if raw.count("```") >= 2 else raw
        raw = raw.removeprefix("json").strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise LLMError("No JSON object found in LLM output")
    try:
        parsed = json.loads(raw[start : end + 1])
    except Exception:
        raise LLMError("LLM output was not valid JSON") from None
    if not isinstance(parsed, dict):
        raise LLMError("LLM output was not a JSON object")
    return parsed


__all__ = [
    "HTTPChatLLMClient",
    "LLMClient",
    "LLMError",
    "extract_json_object",
    "get_llm_client",
]

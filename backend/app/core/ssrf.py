from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443}
MAX_REDIRECTS = 3
MAX_BYTES = 2 * 1024 * 1024
TIMEOUT_SECONDS = 10.0
ALLOWED_CONTENT_TYPES = {"text/html", "application/xhtml+xml", "text/plain"}


class SSRFBlockedError(ValueError):
    pass


@dataclass
class SafeFetchResult:
    url: str
    final_url: str
    status_code: int
    content_type: str | None
    title: str | None
    text_snippet: str | None
    redirect_chain: list[str]


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _validate_host(host: str) -> list[str]:
    if not host:
        raise SSRFBlockedError("Missing host")
    h = host.strip().lower().strip(".")
    if (
        h in {"localhost", "localhost.localdomain"}
        or h.endswith(".local")
        or h.endswith(".internal")
    ):
        raise SSRFBlockedError("Blocked hostname")
    # if literal IP
    try:
        ip = ipaddress.ip_address(h)
        if _is_blocked_ip(ip):
            raise SSRFBlockedError("Blocked IP address")
        return [h]
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(h, None)
    except socket.gaierror as e:
        raise SSRFBlockedError("DNS resolution failed") from e
    resolved: list[str] = []
    for _family, _, _, _, sockaddr in infos:
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        # block cloud metadata explicitly
        if str(ip) == "169.254.169.254":
            raise SSRFBlockedError("Blocked metadata IP")
        if _is_blocked_ip(ip):
            raise SSRFBlockedError("Blocked resolved IP")
        resolved.append(str(ip))
    if not resolved:
        raise SSRFBlockedError("No resolvable public IPs")
    return resolved


def validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise SSRFBlockedError("Scheme not allowed")
    if parsed.username or parsed.password:
        raise SSRFBlockedError("Userinfo in URL not allowed")
    if parsed.hostname is None:
        raise SSRFBlockedError("Missing hostname")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port not in ALLOWED_PORTS:
        raise SSRFBlockedError("Port not allowed")
    _validate_host(parsed.hostname)
    return url


def _extract_title(html: str) -> str | None:
    lower = html.lower()
    i = lower.find("<title")
    if i == -1:
        return None
    j = lower.find(">", i)
    k = lower.find("</title>", j + 1 if j != -1 else i)
    if j == -1 or k == -1:
        return None
    title = html[j + 1 : k].strip()
    return " ".join(title.split())[:300] if title else None


async def safe_fetch(url: str) -> SafeFetchResult:
    current = validate_url(url)
    chain = [current]
    async with httpx.AsyncClient(
        follow_redirects=False,
        timeout=TIMEOUT_SECONDS,
        headers={"User-Agent": "VERITORA-SafeFetch/1.0"},
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            resp = await client.get(current)
            if resp.is_redirect:
                loc = resp.headers.get("location")
                if not loc:
                    raise SSRFBlockedError("Redirect without location")
                nxt = urljoin(current, loc)
                # re-validate every redirect target
                validate_url(nxt)
                chain.append(nxt)
                current = nxt
                continue

            ctype = (resp.headers.get("content-type") or "").split(";")[0].strip().lower() or None
            if ctype and ctype not in ALLOWED_CONTENT_TYPES:
                raise SSRFBlockedError("Content type not allowed")
            content = resp.content[: MAX_BYTES + 1]
            if len(content) > MAX_BYTES:
                raise SSRFBlockedError("Response too large")
            text = None
            title = None
            if ctype in {"text/html", "application/xhtml+xml"}:
                try:
                    html = content.decode(resp.encoding or "utf-8", errors="ignore")
                except Exception:
                    html = content.decode("utf-8", errors="ignore")
                title = _extract_title(html)
                text = " ".join(html.split())[:1000]
            elif ctype == "text/plain":
                text = content.decode("utf-8", errors="ignore")[:1000]
            return SafeFetchResult(
                url=url,
                final_url=str(resp.url),
                status_code=resp.status_code,
                content_type=ctype,
                title=title,
                text_snippet=text,
                redirect_chain=chain,
            )
    raise SSRFBlockedError("Too many redirects")

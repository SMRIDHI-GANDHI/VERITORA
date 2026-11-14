from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse, urlunparse

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
    body_text: str | None = None


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    # ip.is_global is False for private/loopback/link-local/reserved/multicast/unspecified in stdlib
    return not ip.is_global


def _resolve_public_ips(host: str) -> list[str]:
    """Resolve hostname to validated public IP strings (no DNS pinning bypass)."""
    if not host:
        raise SSRFBlockedError("Missing host")
    h = host.strip().lower().strip(".")
    if (
        h in {"localhost", "localhost.localdomain"}
        or h.endswith(".local")
        or h.endswith(".internal")
    ):
        raise SSRFBlockedError("Blocked hostname")

    # literal IP
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
    seen: set[str] = set()
    for _family, _, _, _, sockaddr in infos:
        ip_str = str(sockaddr[0])
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if str(ip) == "169.254.169.254" or _is_blocked_ip(ip):
            raise SSRFBlockedError("Blocked resolved IP")
        if ip_str not in seen:
            seen.add(ip_str)
            resolved.append(ip_str)
    if not resolved:
        raise SSRFBlockedError("No resolvable public IPs")
    # prefer IPv4 for broader compatibility, but keep all public results validated
    resolved.sort(key=lambda x: (":" in x, x))
    return resolved


def _validate_host(host: str) -> list[str]:
    # Backwards-compatible helper used by existing callers/tests.
    return _resolve_public_ips(host)


def _validated_target(url: str) -> tuple[str, str, int, str, str, list[str]]:
    """Validate URL shape/policy and return normalized target details.

    Returns (normalized_url, hostname, port, scheme, host_header, public_ips).
    """
    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    if scheme not in ALLOWED_SCHEMES:
        raise SSRFBlockedError("Scheme not allowed")
    if parsed.username or parsed.password:
        raise SSRFBlockedError("Userinfo in URL not allowed")
    if parsed.hostname is None:
        raise SSRFBlockedError("Missing hostname")
    hostname = parsed.hostname
    port = parsed.port or (443 if scheme == "https" else 80)
    if port not in ALLOWED_PORTS:
        raise SSRFBlockedError("Port not allowed")
    public_ips = _resolve_public_ips(hostname)
    host_header = hostname if parsed.port is None else f"{hostname}:{port}"
    # normalized logical URL keeps original hostname/target
    return url, hostname, port, scheme, host_header, public_ips


def validate_url(url: str) -> str:
    normalized, _host, _port, _scheme, _hdr, _ips = _validated_target(url)
    return normalized


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


def _pinned_request_url(url: str, ip: str) -> str:
    parsed = urlparse(url)
    ip_host = f"[{ip}]" if ":" in ip else ip
    netloc = ip_host if parsed.port is None else f"{ip_host}:{parsed.port}"
    return urlunparse(
        (parsed.scheme, netloc, parsed.path or "", parsed.params, parsed.query, parsed.fragment)
    )


async def safe_fetch(url: str) -> SafeFetchResult:
    """Fetch a public URL safely.

    Connects only to validated public IPs resolved at request time (per hop), preventing
    DNS rebinding/TOCTOU between validation and connection. Host/SNI remain the original
    hostname to preserve TLS certificate verification and virtual hosting.
    """
    logical_url, hostname, _port, scheme, host_header, ips = _validated_target(url)
    chain = [logical_url]
    async with httpx.AsyncClient(
        follow_redirects=False,
        timeout=TIMEOUT_SECONDS,
        headers={"User-Agent": "VERITORA-SafeFetch/1.0"},
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            pinned_url = _pinned_request_url(logical_url, ips[0])
            headers = {"Host": host_header}
            extensions = {"sni_hostname": hostname} if scheme == "https" else None
            resp = await client.get(pinned_url, headers=headers, extensions=extensions)
            if resp.is_redirect:
                loc = resp.headers.get("location")
                if not loc:
                    raise SSRFBlockedError("Redirect without location")
                nxt = urljoin(logical_url, loc)
                logical_url, hostname, _port, scheme, host_header, ips = _validated_target(nxt)
                chain.append(logical_url)
                continue

            ctype = (resp.headers.get("content-type") or "").split(";")[0].strip().lower() or None
            if ctype and ctype not in ALLOWED_CONTENT_TYPES:
                raise SSRFBlockedError("Content type not allowed")
            content = resp.content[: MAX_BYTES + 1]
            if len(content) > MAX_BYTES:
                raise SSRFBlockedError("Response too large")
            text = None
            title = None
            body_text = None
            if ctype in {"text/html", "application/xhtml+xml"}:
                try:
                    html = content.decode(resp.encoding or "utf-8", errors="ignore")
                except Exception:
                    html = content.decode("utf-8", errors="ignore")
                title = _extract_title(html)
                body_text = html[: 2 * 1024 * 1024]
                text = " ".join(html.split())[:1000]
            elif ctype == "text/plain":
                body_text = content.decode("utf-8", errors="ignore")[: 2 * 1024 * 1024]
                text = body_text[:1000]
            return SafeFetchResult(
                url=url,
                final_url=logical_url,
                status_code=resp.status_code,
                content_type=ctype,
                title=title,
                text_snippet=text,
                redirect_chain=chain,
                body_text=body_text,
            )
    raise SSRFBlockedError("Too many redirects")

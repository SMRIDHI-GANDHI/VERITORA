import pytest

from app.core.ssrf import SSRFBlockedError, safe_fetch, validate_url


class _FakeResponse:
    def __init__(self, *, status_code=200, headers=None, content=b"", url="http://example.com/"):
        self.status_code = status_code
        self.headers = headers or {}
        self.content = content
        self.url = url
        self.encoding = "utf-8"
        self.is_redirect = 300 <= status_code < 400

    @property
    def text(self):
        try:
            return self.content.decode(self.encoding or "utf-8", errors="ignore")
        except Exception:
            return ""


class _FakeClient:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, headers=None, extensions=None):
        self.calls.append({"url": url, "headers": headers or {}, "extensions": extensions})
        if not self._responses:
            raise AssertionError("no fake response queued")
        return self._responses.pop(0)


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost/",
        "http://127.0.0.1/",
        "http://0.0.0.0/",
        "http://[::1]/",
        "http://[fd00::1]/",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/",
        "http://192.168.1.1/",
        "http://172.16.0.5/",
        "http://100.64.0.1/",
        "file:///etc/passwd",
        "gopher://example.com/",
        "ftp://example.com/",
        "http://example.com:22/",
        "http://example.com:6379/",
        "http://user:pass@example.com/",
        "http://metadata.google.internal/",
    ],
)
def test_ssrf_blocks_unsafe_targets(url):
    with pytest.raises(SSRFBlockedError):
        validate_url(url)


def test_ssrf_allows_public_http_https_shape(monkeypatch):
    # avoid real DNS variability by stubbing resolution in validate path via getaddrinfo
    import socket

    def fake_getaddrinfo(host, *_args, **_kwargs):
        return [(socket.AF_INET, None, None, "", ("93.184.216.34", 0))]

    monkeypatch.setattr("socket.getaddrinfo", fake_getaddrinfo)
    assert validate_url("https://example.com/path") == "https://example.com/path"
    assert validate_url("http://example.com") == "http://example.com"


def test_ssrf_blocks_dns_to_private_resolution(monkeypatch):
    import socket

    def fake_getaddrinfo(host, *_args, **_kwargs):
        return [(socket.AF_INET, None, None, "", ("10.0.0.5", 0))]

    monkeypatch.setattr("socket.getaddrinfo", fake_getaddrinfo)
    with pytest.raises(SSRFBlockedError):
        validate_url("https://attacker.example/path")


@pytest.mark.asyncio
async def test_safe_fetch_pins_resolved_ip_and_preserves_host_sni(monkeypatch):
    import socket

    def fake_getaddrinfo(host, *_args, **_kwargs):
        return [(socket.AF_INET, None, None, "", ("93.184.216.34", 0))]

    monkeypatch.setattr("socket.getaddrinfo", fake_getaddrinfo)
    fake = _FakeClient(
        [
            _FakeResponse(
                status_code=200,
                headers={"content-type": "text/html"},
                content=b"<html><title>ok</title></html>",
                url="https://93.184.216.34/",
            )
        ]
    )
    import app.core.ssrf as ssrf

    monkeypatch.setattr(ssrf.httpx, "AsyncClient", lambda **kwargs: fake)
    res = await safe_fetch("https://example.com/page")
    assert res.status_code == 200
    assert res.title == "ok"
    assert fake.calls[0]["url"].startswith("https://93.184.216.34")
    assert fake.calls[0]["headers"].get("Host") == "example.com"
    assert fake.calls[0]["extensions"] == {"sni_hostname": "example.com"}


@pytest.mark.asyncio
async def test_safe_fetch_blocks_redirect_to_private_target(monkeypatch):
    import socket

    calls = {"n": 0}

    def fake_getaddrinfo(host, *_args, **_kwargs):
        calls["n"] += 1
        if host == "public.example":
            return [(socket.AF_INET, None, None, "", ("93.184.216.34", 0))]
        if host == "internal.example":
            return [(socket.AF_INET, None, None, "", ("127.0.0.1", 0))]
        return [(socket.AF_INET, None, None, "", ("93.184.216.34", 0))]

    monkeypatch.setattr("socket.getaddrinfo", fake_getaddrinfo)
    fake = _FakeClient(
        [
            _FakeResponse(
                status_code=302,
                headers={"location": "http://internal.example/secret"},
                content=b"",
                url="http://93.184.216.34/",
            )
        ]
    )
    import app.core.ssrf as ssrf

    monkeypatch.setattr(ssrf.httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(SSRFBlockedError):
        await safe_fetch("http://public.example/start")
    assert calls["n"] >= 2


@pytest.mark.asyncio
async def test_safe_fetch_enforces_content_type_and_size(monkeypatch):
    import socket

    def fake_getaddrinfo(host, *_args, **_kwargs):
        return [(socket.AF_INET, None, None, "", ("93.184.216.34", 0))]

    monkeypatch.setattr("socket.getaddrinfo", fake_getaddrinfo)
    import app.core.ssrf as ssrf

    fake_bad_type = _FakeClient(
        [
            _FakeResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                content=b"{}",
            )
        ]
    )
    monkeypatch.setattr(ssrf.httpx, "AsyncClient", lambda **kwargs: fake_bad_type)
    with pytest.raises(SSRFBlockedError):
        await safe_fetch("http://example.com/data")

    fake_big = _FakeClient(
        [
            _FakeResponse(
                status_code=200,
                headers={"content-type": "text/plain"},
                content=b"a" * (2 * 1024 * 1024 + 1),
            )
        ]
    )
    monkeypatch.setattr(ssrf.httpx, "AsyncClient", lambda **kwargs: fake_big)
    with pytest.raises(SSRFBlockedError):
        await safe_fetch("http://example.com/big")

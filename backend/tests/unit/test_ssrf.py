import pytest

from app.core.ssrf import SSRFBlockedError, validate_url


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost/",
        "http://127.0.0.1/",
        "http://0.0.0.0/",
        "http://[::1]/",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/",
        "http://192.168.1.1/",
        "http://172.16.0.5/",
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

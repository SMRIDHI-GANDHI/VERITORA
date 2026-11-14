from datetime import UTC, datetime

from app.services.network import (
    _hmac_hash,
    description_fingerprint,
    detect_report_spikes,
    minhash_signature,
    minhash_similarity,
    normalize_email_domain,
    normalize_handle,
    normalize_payment_handle,
    normalize_phone,
    normalize_website_domain,
    text_shingles,
)


def test_normalize_email_domain():
    assert normalize_email_domain("User@Example.COM") == "example.com"
    assert normalize_email_domain("example.com") == "example.com"
    assert normalize_email_domain(None) is None


def test_normalize_website_domain():
    assert normalize_website_domain("https://www.Example.com/path") == "www.example.com"
    assert normalize_website_domain("example.com:443/") == "example.com"


def test_normalize_phone_e164_like():
    assert normalize_phone("9876543210") == "+919876543210"
    assert normalize_phone("+91 98765 43210") == "+919876543210"
    assert normalize_phone(None) is None


def test_normalize_handle_and_payment():
    assert normalize_handle(" @Recruiter_Name ") == "recruiter_name"
    assert normalize_payment_handle("  user@upi  ") == "user@upi"


def test_hmac_hash_stable():
    a = _hmac_hash("example.com", key="secret-key")
    b = _hmac_hash("example.com", key="secret-key")
    c = _hmac_hash("example.com", key="other")
    assert a == b and len(a) == 64
    assert a != c


def test_minhash_similarity_high_for_similar_text():
    t1 = "We are hiring software engineers. Pay registration fee to apply now."
    t2 = "We are hiring software engineers. Pay registration fee to apply today."
    s1 = minhash_signature(t1)
    s2 = minhash_signature(t2)
    sim = minhash_similarity(s1, s2)
    assert sim >= 0.5


def test_minhash_similarity_low_for_different_text():
    t1 = "Senior backend engineer role with health benefits and remote work options."
    t2 = "Pay urgent registration deposit now to get guaranteed job selection."
    s1 = minhash_signature(t1)
    s2 = minhash_signature(t2)
    sim = minhash_similarity(s1, s2)
    assert sim < 0.6


def test_description_fingerprint_and_shingles():
    fp = description_fingerprint("Hello world hello world")
    assert isinstance(fp, str) and len(fp) == 64
    sh = text_shingles("one two three four", k=2)
    assert "one two" in sh and "two three" in sh


class R:
    def __init__(self, company_id, created_at):
        self.company_id = company_id
        self.created_at = created_at


def test_detect_report_spikes():
    now = datetime.now(UTC)
    reports = [R("c1", now), R("c1", now), R("c1", now), R("c2", now)]
    spikes = detect_report_spikes(reports, days=7, threshold=3)
    assert len(spikes) == 1
    assert spikes[0]["count"] == 3
    assert "entity_ref_hash" in spikes[0] and len(spikes[0]["entity_ref_hash"]) == 64
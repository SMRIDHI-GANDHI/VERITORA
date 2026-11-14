from __future__ import annotations

import re

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(r"(?:\+?\d[\s-]?){10,13}")
ID12_RE = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")  # Aadhaar-like
PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b", re.IGNORECASE)
IFSC_RE = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b", re.IGNORECASE)
UPI_RE = re.compile(r"\b[\w.\-]{2,}@[a-z]{2,}\b", re.IGNORECASE)
CARD_RE = re.compile(r"\b(?:\d[ -]*?){13,19}\b")


def _luhn_ok(num: str) -> bool:
    digits = [int(d) for d in num if d.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def scan_pii(text: str) -> tuple[bool, list[str]]:
    warnings: list[str] = []
    if EMAIL_RE.search(text):
        warnings.append("email_detected")
    if PHONE_RE.search(text):
        warnings.append("phone_detected")
    if ID12_RE.search(text):
        warnings.append("id_number_like_detected")
    if PAN_RE.search(text):
        warnings.append("pan_like_detected")
    if IFSC_RE.search(text):
        warnings.append("ifsc_detected")
    # UPI: exclude normal emails by requiring known-ish handle pattern? keep simple
    for m in UPI_RE.finditer(text):
        v = m.group(0)
        if "@" in v and "." not in v.split("@")[-1]:
            warnings.append("upi_handle_detected")
            break
    for m in CARD_RE.finditer(text):
        if _luhn_ok(m.group(0)):
            warnings.append("card_like_detected")
            break
    # dedupe
    out = sorted(set(warnings))
    return (len(out) > 0, out)

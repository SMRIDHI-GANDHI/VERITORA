from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from typing import Any, cast


@dataclass
class ExtractionResult:
    text: str
    confidence: float
    status: str  # extracted | partial | inconclusive
    method: str
    fields: dict[str, Any] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


PDF_MAGIC = b"%PDF"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"


def detect_file_type(data: bytes) -> str | None:
    if data.startswith(PDF_MAGIC):
        return "pdf"
    if data.startswith(PNG_MAGIC):
        return "png"
    if data.startswith(JPEG_MAGIC):
        return "jpg"
    return None


def av_scan_hook(data: bytes) -> tuple[bool, str | None]:
    """Pluggable AV hook. Default no-op; integrate scanner via env/hook in production."""
    _ = data
    return True, None


def strip_metadata_best_effort(data: bytes, file_type: str) -> bytes:
    # Best-effort: avoid adding heavy deps; keep original if stripping not available.
    # For images, Pillow could strip EXIF; for PDF, PyMuPDF could rewrite. Optional.
    try:
        if file_type in {"png", "jpg"}:
            pil_image_mod = cast(Any, __import__("PIL.Image", fromlist=["Image"]))
            img = pil_image_mod.open(io.BytesIO(data))
            out = io.BytesIO()
            clean = pil_image_mod.new(img.mode, img.size)
            clean.putdata(list(img.getdata()))
            fmt = "PNG" if file_type == "png" else "JPEG"
            clean.save(out, format=fmt)
            return bytes(out.getvalue())
    except Exception:
        pass
    try:
        if file_type == "pdf":
            fitz = cast(Any, __import__("fitz"))
            doc = fitz.open(stream=data, filetype="pdf")
            doc.set_metadata({})
            out = doc.tobytes(garbage=4, deflate=True)
            doc.close()
            return bytes(out)
    except Exception:
        pass
    return data


def _extract_pdf_text(data: bytes) -> tuple[str, float, str, list[str]]:
    notes: list[str] = []
    try:
        fitz = cast(Any, __import__("fitz"))

        doc = fitz.open(stream=data, filetype="pdf")
        parts: list[str] = []
        for page in doc:
            parts.append(str(page.get_text("text") or ""))
        text = "\n".join(parts).strip()
        doc.close()
        if len(text) >= 40:
            conf = min(0.98, 0.7 + min(len(text), 2000) / 5000)
            return text, conf, "pymupdf_text", notes
        notes.append(
            "PDF text layer empty or too small; OCR fallback attempted if available."
        )
    except Exception as e:
        notes.append(f"PDF text extraction unavailable: {type(e).__name__}")
    # OCR fallback for scanned PDFs: render pages and OCR if libs available.
    try:
        fitz = cast(Any, __import__("fitz"))
        pytesseract = cast(Any, __import__("pytesseract"))
        pil_image_mod = cast(Any, __import__("PIL.Image", fromlist=["Image"]))
        image_open = pil_image_mod.open

        doc = fitz.open(stream=data, filetype="pdf")
        texts: list[str] = []
        for i, page in enumerate(doc):
            if i >= 5:  # cap pages for safety/perf
                notes.append("OCR limited to first 5 pages.")
                break
            pix = page.get_pixmap(dpi=200)
            img = image_open(io.BytesIO(pix.tobytes("png")))
            texts.append(str(pytesseract.image_to_string(img, lang="eng+hin") or ""))
        doc.close()
        text = "\n".join(texts).strip()
        if text:
            conf = 0.55 if len(text) < 80 else 0.7
            return text, conf, "pymupdf_ocr", notes
    except Exception as e:
        notes.append(f"OCR fallback unavailable: {type(e).__name__}")
    return "", 0.0, "unavailable", notes


def _extract_image_text(data: bytes) -> tuple[str, float, str, list[str]]:
    notes: list[str] = []
    try:
        pytesseract = cast(Any, __import__("pytesseract"))
        pil_image_mod = cast(Any, __import__("PIL.Image", fromlist=["Image"]))
        img = pil_image_mod.open(io.BytesIO(data))
        text = str(pytesseract.image_to_string(img, lang="eng+hin") or "").strip()
        if text:
            conf = 0.5 if len(text) < 60 else 0.72
            return text, conf, "pytesseract", notes
        notes.append("OCR produced no readable text.")
        return "", 0.0, "pytesseract", notes
    except Exception as e:
        notes.append(f"OCR unavailable: {type(e).__name__}")
        return "", 0.0, "unavailable", notes


_EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
_PHONE_RE = re.compile(r"(?:\+?\d[\d\s\-()]{7,}\d)")
_URL_RE = re.compile(r"https?://[^\s<>\"']+|www\.[^\s<>\"']+", re.I)
_DOMAIN_RE = re.compile(
    r"\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b", re.I
)
_MONEY_RE = re.compile(
    r"(?:rs\.?|inr|₹)\s*\d[\d,]*(?:\.\d+)?"
    r"(?:\s*(?:lakh|lac|lpa|per month|/month|pm))?",
    re.I,
)
_DATEISH_RE = re.compile(r"\b(joining|start|date|doj)\b[^\n]{0,40}", re.I)


def extract_fields(text: str) -> dict[str, Any]:
    emails = sorted(set(m.group(0) for m in _EMAIL_RE.finditer(text)))
    phones = sorted(set(re.sub(r"\s+", " ", m.group(0)).strip() for m in _PHONE_RE.finditer(text)))
    urls = sorted(set(m.group(0) for m in _URL_RE.finditer(text)))
    domains = sorted(
        {
            d.group(0).lower()
            for d in _DOMAIN_RE.finditer(text)
            if "@" not in d.group(0) and not d.group(0).lower().endswith((".png", ".jpg", ".pdf"))
        }
    )
    # derive domains from emails/urls too
    for e in emails:
        if "@" in e:
            domains.append(e.split("@", 1)[1].lower())
    domains = sorted(set(domains))

    salary_mentions = [m.group(0).strip() for m in _MONEY_RE.finditer(text)]
    joining = [m.group(0).strip() for m in _DATEISH_RE.finditer(text)]

    # heuristic company name: line after "Company" or "From" or first non-empty short line
    company_name = None
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        m = re.search(r"\b(company|organization|employer)\s*[:\-]\s*(.+)", s, re.I)
        if m:
            cand = m.group(2).strip(" :-\t")
            if 2 <= len(cand) <= 120:
                company_name = cand
                break
    if not company_name:
        for line in text.splitlines()[:8]:
            s = line.strip()
            if 3 <= len(s) <= 80 and not re.search(r"offer letter|subject|date\b", s, re.I):
                company_name = s
                break

    payment_clauses: list[str] = []
    for m in re.finditer(
        r".{0,40}(fee|deposit|security|registration|payment|pay).{0,40}", text, re.I
    ):
        snippet = re.sub(r"\s+", " ", m.group(0)).strip()
        if snippet and snippet not in payment_clauses:
            payment_clauses.append(snippet)
    payment_clauses = payment_clauses[:10]

    contacts = emails + phones
    return {
        "company_name": company_name,
        "contacts": contacts,
        "emails": emails,
        "phones": phones,
        "domains": domains,
        "urls": urls,
        "salary_mentions": salary_mentions[:10],
        "joining_conditions": joining[:10],
        "payment_clauses": payment_clauses,
    }


def extract_offer_letter(data: bytes, file_type: str) -> ExtractionResult:
    if file_type == "pdf":
        text, conf, method, notes = _extract_pdf_text(data)
    elif file_type in {"png", "jpg"}:
        text, conf, method, notes = _extract_image_text(data)
    else:
        return ExtractionResult(
            text="",
            confidence=0.0,
            status="inconclusive",
            method="unsupported",
            fields={},
            notes=["Unsupported file type."],
        )

    fields = extract_fields(text) if text else {}
    if not text:
        status = "inconclusive"
    elif conf >= 0.7 and len(text) >= 60:
        status = "extracted"
    else:
        status = "partial"
    return ExtractionResult(
        text=text,
        confidence=round(conf, 3),
        status=status,
        method=method,
        fields=fields,
        notes=notes,
    )

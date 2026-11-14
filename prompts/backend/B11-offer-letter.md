# B11 — Offer-letter upload, extraction, analysis
Agent: @backend-dev | Reads: 06, 08 (uploads), 07

## Build
- `POST /analyze/offer-letter` multipart (pdf/png/jpg ≤ 5 MB): magic-byte check, AV hook, metadata strip, private storage with TTL.
- Extraction: PyMuPDF text for text PDFs; OCR (Tesseract via `pytesseract`) for scans/images, language packs eng+hin; confidence reported.
- Extract company name, contacts, domains, salary, joining conditions, payment clauses; feed text through analyzer, run company/recruiter checks on extracted contacts; add `OFFER_CONTACT_MISMATCH` evidence only on actual mismatch with independently verified info.
- Explicit consent flag in request; no third-party AI used unless LLM enabled and consent true.
- Retention: delete original file after analysis unless user opts to keep; default TTL 24h.

## Acceptance
Demo scenario 3 yields mismatch factor with sources; malformed/malicious files rejected; OCR failure → `inconclusive` extraction, not a crash; no raw file contents in logs.

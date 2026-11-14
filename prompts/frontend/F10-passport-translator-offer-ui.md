# F10 — Trust Passport, translator, offer-letter UI
Agent: @frontend-dev | Reads: 09, 06, 03 FR-TP/FR-LG

## Build
- Passport creation dialog (expiry choice, copy link once, revoke), public `/passport/:token` page showing checks performed and not performed, statuses, factors, community summary, recommendation, rules version, expiry and refresh guidance, prominent "snapshot, not a certificate" disclaimer; no personal info.
- Translator panel: explanation language selector, side-by-side original and translated text, "machine translated" uncertainty badge, highlighted payment/urgency/guarantee/sensitive-data phrases.
- Offer-letter upload: consent checkbox, file type/size guidance, redaction advice, progress, extraction preview with confidence, then analysis.

## Acceptance
Revoked/expired passport page shows neutral unavailable state; original text always visible with translation; upload rejects wrong types client-side and handles server errors; Hindi strings complete; print stylesheet for passport.

# Eval fixtures (synthetic)

This directory contains **synthetic, clearly labeled** examples for offline evaluation of the rule-based analyzer.
No real user data or licensed third-party datasets are included.

- `payment_v1.jsonl`: 60 examples (English + Hinglish) with labels for payment/scam-risk signals vs legitimate postings.
- Labels: `1` = suspicious/risky (e.g. payment/guarantee/urgency/sensitive-data asks), `0` = legitimate/hard negative (including "no fee" statements).
- Use for metrics reporting only; do not tune silently on the test split.

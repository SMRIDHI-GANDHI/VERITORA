# B07 — Demo seed, evaluation harness, API-level E2E
Agent: @backend-dev | Reads: 10-TEST-PLAN, 07 §5

## Build
- `app.scripts.seed_demo`: synthetic data for the 5 demo scenarios; every row `is_synthetic=true`; idempotent.
- `app/eval/`: loader for `tests/fixtures/eval/*.jsonl` (text, label, language), runner printing precision/recall/F1, confusion matrix, per-language metrics, FP list on legitimate-startup subset; writes `reports/eval-<rules_version>.json`.
- Create ≥ 60 synthetic labeled examples (en + Hinglish), including hard negatives (legit startups, "no fee" statements) and indirect payment asks. Mark dataset as synthetic in a README.
- API-level E2E test: register → analyze → verify company → submit report → moderator approves → public summary visible with neutral label.

## Acceptance
Seed runs twice without duplicates; eval command runs and outputs metrics (report actual numbers, do not tune on the test split silently); E2E passes in CI.

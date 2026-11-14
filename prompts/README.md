# Prompts for OpenCode

How to use: start OpenCode in the repo root, then either run `/next-task B04` or paste the contents of the brief. Use `@backend-dev` / `@frontend-dev` for focused work, `/verify-spec` and `/security-review` after each task.

Order: `00-master-bootstrap.md` once, then follow `docs/11-ROADMAP.md`.

## Standard task footer (every brief implies this)
**Rules:** follow AGENTS.md; do not change specs silently; ask before new dependencies, schema or API changes outside docs; keep app runnable; never fabricate verification data; no verdict wording.
**Deliver:** (1) files created/changed, (2) features implemented mapped to requirement IDs, (3) commands to run, (4) env vars required, (5) tests run with real output, (6) known limitations and next steps. Do not claim completion unless it works end to end.

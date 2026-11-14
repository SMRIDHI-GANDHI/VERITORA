# F06 — Admin / moderator dashboard
Agent: @frontend-dev | Reads: 09, 06 (admin), 04 §5, 03 FR-AD

## Build
- Role-gated `/admin`: overview (counts), moderation queue with filters (status, category, pii_flagged, spam flag), report detail pane (original text visible to moderators only, redaction tool to author `public_summary`, evidence viewer with redaction status), action bar (approve, reject, inconclusive, request evidence, remove) requiring a reason; private notes field; transition buttons only for valid next states.
- Rating review tab (duplicates/spam clusters), appeals tab.
- Audit log view (admin only).

## Acceptance
Invalid transitions disabled; reason required; 403 handling; no private-note leakage in non-moderator views (test with role fixtures); keyboard-operable queue; confirmation dialogs for destructive actions.

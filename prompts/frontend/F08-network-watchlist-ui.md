# F08 — Network graph and watchlist (moderator)
Agent: @frontend-dev | Reads: 09, 03 FR-NW/FR-SR, 08

## Build
- `/admin/network`: alerts list + interactive graph (Cytoscape.js or react-force-graph) with node types, edge types, confidence, similarity; side panel with shared attributes (hashed/masked identifiers only), links to report records and timestamps; **persistent banner: "Lead for review, not proof of wrongdoing."**
- Accessible alternative: relationships table view (keyboard/screen reader), graph canvas has text summary.
- Watchlist manager: entries, status transitions (moderator approval for elevated), evidence references, appeals queue; neutral-language preview of what the public sees.
- Graph colors verified in both themes; reduced-motion disables force animation.

## Acceptance
No raw identifiers rendered; promotion actions require reason and show audit confirmation; table view parity with graph; keyboard operability tests; large-graph performance guard (cap + "show more").

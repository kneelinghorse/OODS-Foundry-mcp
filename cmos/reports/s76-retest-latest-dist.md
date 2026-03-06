# Sprint 76 Latest-Dist Retest

**Date:** 2026-03-06  
**Tester:** Codex GPT-5  
**Mission:** `s76-m07`  
**Repo:** `OODS-Foundry-mcp`  
**Runtime under test:** `packages/mcp-server/dist/*` rebuilt on 2026-03-06

---

## Executive Summary

The latest rebuilt dist validates the Sprint 76 fix set. Generic dashboard prompts no longer auto-detect incidental objects from lowercase noun collisions such as `plan downgrade anomalies`, search-oriented slots now choose `SearchInput` ahead of generic `Input`, list trait placements no longer emit `before` / `after` slot warnings, `code.generate` now refuses unknown-component schemas, and `repl.render` preview summaries no longer frame errored renders as ready.

One compile-time blocker also surfaced during the retest: two optional-map narrowing issues were preventing `@oods/mcp-server` from rebuilding. Those guards were fixed as part of this mission so the retest could run against fresh dist output instead of stale artifacts.

This is a targeted latest-dist retest, not a new full-platform rerun.

---

## Completion Scorecard

| Area | Result | Latest-dist evidence |
|---|---|---|
| Object auto-detection confidence filtering | Pass | Long dashboard prompt stays `layout: "dashboard"` with `objectAutoDetected: null` and no incidental `Plan` warnings |
| Search slot component bias | Pass | `search-input` and search-oriented `filter-control` rank `SearchInput` above `Input` on rebuilt dist |
| Slot vocabulary unification | Pass | `design.compose({ object: "User", context: "list" })` emits no `OODS-V120` placement warnings and keeps `SearchInput` + `Button` while also placing summary badges |
| Codegen schema validity gate | Pass | `code.generate` returns `status: "error"` with `OODS-V119` and `meta.unknownComponents` for `UnknownComponent` |
| Render preview messaging integrity | Pass | Invalid render preview now says `Render blocked: 1 validation error`; valid render preview still says `Render ready for 1 screen` |
| Dist rebuild freshness | Pass | `pnpm --filter @oods/mcp-server run build` completed successfully before retest lanes ran |

---

## Dist Evidence

### 1. Object auto-detection no longer overreaches

Retest prompt:

`Create an operations dashboard ... plan downgrade anomalies ...`

Latest-dist result:

- `status: "ok"`
- `layout: "dashboard"`
- `objectUsed: null`
- `meta.objectAutoDetected: null`
- warning list empty

This closes the Sprint 75 carry-forward bug where `Plan` was attached from a lowercase incidental noun inside a generic dashboard brief.

### 2. Search ranking now prefers search-specific controls

Latest-dist selector checks:

- `selectComponent("search-input", { intentContext: "search input", slotPosition: "header" })`
  - top candidate: `SearchInput`
  - `Input` remains present but no longer wins the slot
- `selectComponent("filter-control", { intentContext: "search accounts by name", slotPosition: "header" })`
  - top candidate: `SearchInput`
  - `Input` ranks below both `SearchInput` and `Select`

This is the intended Sprint 76 behavior: search-driven slots resolve to search-specific components, while generic form fields remain on their normal controls.

### 3. List slot vocabulary is aligned with trait placement

Latest-dist `User` list compose:

- `status: "ok"`
- warning list empty
- selections:
  - `search -> SearchInput`
  - `toolbar-actions -> Button`
  - `filters -> Select`
  - `pagination -> PaginationBar`
- schema also contains:
  - `MessageStatusBadge`
  - `AddressSummaryBadge`
  - `PreferenceSummaryBadge`
  - `RoleBadgeList`

This validates that `before` / `after` trait placements now map into real list slots without suppressing the primary toolbar controls.

### 4. Invalid codegen schemas are now blocked

Latest-dist `code.generate` with `UnknownComponent` now returns:

- `status: "error"`
- `code: ""`
- `errors[0].code: "OODS-V119"`
- `meta.unknownComponents: ["UnknownComponent"]`

This closes the prior behavior where codegen would emit unusable framework output for registry-invalid schemas.

### 5. Render preview summaries now match render state

Latest-dist `repl.render` now reports:

- valid schema: `Render ready for 1 screen`
- invalid schema: `Render blocked: 1 validation error`

This removes the trust-breaking case where agent-facing preview text implied success even when the render returned `status: "error"`.

---

## Updated Score

This is a targeted latest-dist retest score, not a full 25-task rerun.

### Platform Score: 84/100

| Category | Weight | Score | Notes |
|---|---:|---:|---|
| API Surface Completeness | 15 | 14/15 | Tool surface remains aligned from Sprint 75 |
| Composition Intelligence | 25 | 20/25 | Object filtering, search disambiguation, and slot vocabulary all validated on dist |
| Code Generation Quality | 20 | 13/20 | Invalid schemas now hard-fail; normal codegen workflow still passes |
| Pipeline & Persistence | 15 | 14/15 | Rebuild + existing artifact reliability remain sound |
| Error Handling & DX | 10 | 10/10 | Preview messaging and codegen failure behavior are now honest and actionable |
| Visualization | 10 | 9/10 | Sprint 75 viz-valid state remains the latest validated dist result |
| Documentation & Discoverability | 5 | 4/5 | Roadmap + Sprint 76 retest report updated; broader docs alignment still open |
| **Total** | **100** | **84/100** | |

### Agent UX Score: 8.7/10

- Better: dashboard prompts no longer accumulate irrelevant object warnings from incidental nouns.
- Better: search-driven slots choose the right control more often on first compose.
- Better: render/codegen now fail with honest agent-facing messaging instead of success-looking summaries or unusable output.

### Compose Quality: 4.1/5

- Up from 3.4/5 because the three highest-signal composition gaps from the Sprint 75 carry-forward set now validate on dist.
- Still below perfect because field-level specialization outside this retest set and deeper object-backed dashboard composition were not re-scored here.

---

## Remaining Validated Gaps

1. Field-level form specialization was not re-scored in this targeted latest-dist pass and should remain on the composition-quality watchlist until explicitly revalidated.
2. Object-backed dashboard depth still needs a focused pass; Sprint 76 fixed incidental object attachment, but did not add richer dashboard-specific object view extensions.
3. Codegen quality is materially better, but prop-binding depth and framework polish still have headroom beyond the new invalid-schema gate.

---

## Recommendation

Sprint 76 should be treated as a successful composition + codegen quality sprint. The latest rebuilt dist closes the Sprint 75 carry-forward correctness issues that were still affecting operator trust. Carry forward the remaining work as targeted quality and polish tasks rather than runtime blockers.

# Sprint 75 Latest-Dist Retest

**Date:** 2026-03-06  
**Tester:** Codex GPT-5  
**Mission:** `s75-m05`  
**Repo:** `OODS-Foundry-mcp`  
**Runtime under test:** `packages/mcp-server/dist/*` and `packages/mcp-bridge/dist/*` rebuilt on 2026-03-06

---

## Executive Summary

The latest built dist validates the Sprint 75 defect set. Product list composition no longer emits `ActiveFilterChips`, viz schemas no longer emit registry-invalid `Box`, artifact tools write first-run outputs correctly, bridge `/tools` now reflects the actual enabled tool surface, and section-heavy dashboard prompts expand past the old fixed 4-slot scaffold.

The retest also exposed one additional prompt-routing bug during the session: dashboard prompts starting with imperative wording such as `Create an operations dashboard...` could still be pushed off-course by naive `create` and substring keyword matches plus auto-detected object context precedence. That heuristic was fixed in the same mission and revalidated on the rebuilt dist.

This is now a quality backlog, not a runtime-correctness backlog.

---

## Completion Scorecard

| Area | Result | Latest-dist evidence |
|---|---|---|
| Registry-safe object compose | Pass | `design.compose({ object: "Product", context: "list" })` -> `layout: "list"`, `validation: "ok"`, `hasActiveFilterChips: false` |
| Viz schema contract | Pass | Manual and object-backed `viz.compose` both validate; root component is `Stack` in both cases |
| Artifact generation | Pass | `reviewKit.create({ apply: true })` writes `review-kit.txt`, `transcript.json`, `bundle_index.json` |
| Bridge/server tool-surface parity | Pass | `/tools` reports 15 tools in `default`, 24 tools in `all`, both with `registrySource: "dist/tools/registry.json"` |
| Long-intent dashboard slot scaling | Pass | Freeform dashboard intent now composes as `layout: "dashboard"` with 27 section-linked ids including `main-section-*` and `sidebar-*` |
| Retest follow-up heuristic fix | Pass | Leading `Create ...` no longer forces `form`; auto-detected context no longer overrides section-signaled dashboard layout |

---

## Before / After Evidence

| Issue | Before Sprint 75 | Latest-dist retest |
|---|---|---|
| Product list compose | `ActiveFilterChips` emitted; validation failed | `validation: "ok"` and no `ActiveFilterChips` in schema |
| Viz compose | Root `Box`; validator rejected schema | Manual/object-backed roots are both `Stack`; validation passes |
| `reviewKit.create` | First-run `ENOENT` on output file | Artifact, transcript, and bundle all exist on disk |
| Bridge `/tools` | Reflected policy allowlist instead of actual enabled toolset | `/tools` now changes with `MCP_TOOLSET` and exposes toolset metadata |
| Long dashboard intents | Collapsed to fixed generic slots; earlier prompts also misrouted | Section-heavy prompt produces expanded `main-section-1..5` and `sidebar` regions |

Adjacent artifact checks also remained green on latest dist:

- `purity.audit({ apply: true })` wrote `purity-audit.json`, transcript, and bundle index.
- `vrt.run({ apply: true })` wrote `vrt-summary.json`, transcript, and bundle index.

---

## Runtime Notes

### Server dist checks

- `Product list compose`
  - `layout: "list"`
  - `validation: "ok"`
  - warning reduced to slot-position mismatch for `ClassificationBadge`; no registry-invalid component emitted
- `Viz compose`
  - manual: `status: "ok"`, root `Stack`
  - object-backed: `status: "ok"`, root `Stack`
- `reviewKit.create`
  - artifact: `/Users/systemsystems/portfolio/Design-Tools/OODS-Foundry-mcp/artifacts/current-state/2026-03-06/reviewKit.create/review-kit.txt`
  - transcript: `/Users/systemsystems/portfolio/Design-Tools/OODS-Foundry-mcp/artifacts/current-state/2026-03-06/reviewKit.create/transcript.json`
  - bundle: `/Users/systemsystems/portfolio/Design-Tools/OODS-Foundry-mcp/artifacts/current-state/2026-03-06/reviewKit.create/bundle_index.json`

### Bridge dist checks

- `MCP_TOOLSET=default`
  - `/tools` exposed 15 external tool names
  - `/health` reported `enabledCount: 15`
- `MCP_TOOLSET=all`
  - `/tools` exposed 24 external tool names
  - `/health` reported `enabledCount: 24`
- Both modes reported:
  - `registrySource: "dist/tools/registry.json"`
  - matching `toolset.mode` metadata in `/tools` and `/health`

### Composition quality retest

The freeform dashboard prompt used in this retest now resolves to `layout: "dashboard"` and validates cleanly. The rebuilt dist produced 27 section-linked ids, including:

- `slot-main-content-10`
- `slot-main-section-1-13`
- `slot-main-section-2-16`
- `slot-main-section-3-19`
- `slot-main-section-4-22`
- `slot-main-section-5-25`
- `slot-sidebar-30`

The remaining warning on that prompt is now the real one:

- `OODS-V121`: auto-detected object `Plan` is `beta`
- `OODS-V119`: `Plan` has no `dashboard` view extensions

That is a backlog-quality issue, not a runtime freshness issue.

---

## Updated Score

This is a targeted latest-dist retest score, not a full 25-task rerun.

### Platform Score: 75/100

| Category | Weight | Score | Notes |
|---|---:|---:|---|
| API Surface Completeness | 15 | 14/15 | Bridge tool surface now accurately reflects enabled tools |
| Composition Intelligence | 25 | 16/25 | Dashboard section scaling and safer layout heuristics improved; field specialization/search quality still lag |
| Code Generation Quality | 20 | 8/20 | No new regressions found, but prop-binding quality was not reworked in Sprint 75 |
| Pipeline & Persistence | 15 | 14/15 | Artifact tools now succeed on clean apply runs |
| Error Handling & DX | 10 | 10/10 | Toolset metadata and focused warnings improve operator trust |
| Visualization | 10 | 9/10 | Viz compose path now validates cleanly on latest dist |
| Documentation & Discoverability | 5 | 4/5 | Retest report + roadmap updated; broader docs alignment still incomplete |
| **Total** | **100** | **75/100** | |

### Agent UX Score: 8.0/10

- Better: runtime is materially more trustworthy, and the bridge/server surface no longer lies about enabled tools.
- Better: long dashboard prompts now create expanded dashboard structure instead of collapsing or misrouting on imperative wording.
- Still weak: incidental object auto-detection can inject irrelevant object warnings into otherwise generic dashboard briefs.

### Compose Quality: 3.4/5

- Up from the prior 2.x range because long-intent section parsing and dashboard slot scaling are now real.
- Still below target because field-level specialization and search/filter disambiguation are not yet consistently semantic.

---

## Remaining Validated Gaps

1. `Plan` was auto-detected from `plan downgrade anomalies` inside a generic dashboard prompt. Object auto-detection still needs stronger multi-signal filtering.
2. Dashboard object contexts remain shallow. The retest still hit `OODS-V119` because the detected object had no `dashboard` view extensions.
3. Form field differentiation and `SearchInput` vs `Input` ranking were not part of this retest and remain valid carry-forward quality work from the earlier Sprint 75 backlog.

---

## Recommendation

Sprint 75 should be treated as a successful trustworthiness sprint. The high-risk latest-runtime defects validated in this report are closed on dist. Carry forward the remaining work as composition-quality improvements rather than correctness blockers.

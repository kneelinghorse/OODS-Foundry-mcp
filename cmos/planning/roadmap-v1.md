# OODS Foundry MCP — V1 Roadmap

> Updated: 2026-03-06 | Sprint 76 latest-dist retest `s76-m07`

## Current State

- **Platform Score:** 84/100 (targeted latest-dist retest)
- **Agent UX Score:** 8.7/10
- **Compose Quality:** 4.1/5
- **Retest Coverage:** 6/6 Sprint 76 validation lanes passed on rebuilt dist
- **Critical Runtime Defects Open:** 0 in the Sprint 76 retest set

## Validated Release Gates

| Gate | Status | Sprint | Evidence |
|------|--------|--------|----------|
| Registry-safe object compose | Pass | S75 | `Product` list compose validates and no longer emits `ActiveFilterChips` |
| Viz schemas valid on latest dist | Pass | S75 | Manual and object-backed `viz.compose` both validate with root `Stack` |
| Artifact tools succeed on first apply run | Pass | S75 | `reviewKit.create`, `purity.audit`, and `vrt.run` all write artifact bundles |
| Bridge `/tools` matches enabled tool surface | Pass | S75 | `default` exposes 15 tools, `all` exposes 24, both from `dist/tools/registry.json` |
| Long dashboard intents scale past fixed 4-slot layout | Pass | S75 | Section-heavy dashboard prompt yields expanded `main-section-*` and `sidebar-*` regions |
| Incidental object auto-detection blocked | Pass | S76 | Dashboard prompt with `plan downgrade anomalies` no longer auto-attaches `Plan` |
| Invalid codegen schemas are rejected | Pass | S76 | `code.generate` now returns `status: "error"` + `OODS-V119` for unknown components |
| Render preview summaries are honest | Pass | S76 | Invalid renders now say `Render blocked: N validation error(s)` |
| End-to-end compose/validate/render/codegen | Pass | S65 | Core pipeline path remains intact; no Sprint 75 regressions found |

## Sprint 75 Validated Fixes

| Mission | Fix | Status | Latest evidence |
|---------|-----|--------|-----------------|
| `s75-m04` | Dashboard slot scaling + long-intent section parsing | Fixed | Latest dist now emits expanded dashboard sections instead of collapsing to 4 generic slots |
| `s75-m06` | Registry-safe Product list compose | Fixed | `validation: "ok"` and no `ActiveFilterChips` in schema |
| `s75-m07` | Viz schema contract alignment | Fixed | `viz.compose` outputs validate cleanly; root is `Stack` |
| `s75-m08` | Artifact-path reliability | Fixed | First-run apply paths create parent directories and write outputs |
| `s75-m09` | Bridge/server tool-surface parity | Fixed | `/tools` and `/health` now expose actual enabled toolset metadata |
| `s75-m05` | Retest follow-up prompt routing heuristics | Fixed | Leading `Create ...` no longer forces dashboard prompts into form/detail drift via noisy context inference |

## Sprint 76 Validated Fixes

| Mission | Fix | Status | Latest evidence |
|---------|-----|--------|-----------------|
| `s76-m02` | Object auto-detection confidence filtering | Fixed | Generic dashboard prompt no longer auto-detects `Plan` from lowercase incidental text |
| `s76-m03` | SearchInput ranking bias | Fixed | Search-oriented `filter-control` and `search-input` rank `SearchInput` above generic `Input` |
| `s76-m04` | Slot vocabulary unification | Fixed | `User` list compose emits no `OODS-V120` placement warnings and retains primary toolbar controls |
| `s76-m05` | Codegen schema validity gate | Fixed | Unknown components now stop `code.generate` with `OODS-V119` and no code output |
| `s76-m06` | Render preview messaging integrity | Fixed | Invalid render previews now say `Render blocked` instead of `Render ready` |

## Carry-Forward Backlog

### P1 — Composition Quality

| Item | Latest evidence | Notes |
|------|-----------------|-------|
| Form field differentiation latest-dist score refresh | Not re-scored in the Sprint 76 targeted retest | Keep on the watchlist until the latest dist explicitly revalidates field-type specialization quality |
| Dashboard object view extension depth | Latest Sprint 76 retest removed incidental object attachment, but did not add richer object-backed dashboard extensions | Still a quality-depth gap, not a runtime blocker |
| Toolbar/secondary placement semantics beyond current list cases | Sprint 76 validated the `User` list path | Broader layout-specific placement polish can now be treated as refinement work |

### P2 — Platform Polish

| Item | Notes |
|------|-------|
| SchemaRef TTL documentation | TTL is visible in responses but still under-documented |
| `apply` pattern consistency | Persistence/output semantics still vary across tools |
| Compact mode outside pipeline | `repl.render` and `code.generate` still lag pipeline compact ergonomics |
| Trait-name format docs for mapping | Namespace expectations are still easy to miss |

## Score Snapshot

| Category | Weight | Current | Notes |
|----------|--------|---------|-------|
| API Surface Completeness | 15 | 14 | Bridge tool-surface honesty fixed |
| Composition Intelligence | 25 | 20 | Object filtering, search disambiguation, and slot vocabulary now validate on latest dist |
| Code Generation Quality | 20 | 13 | Invalid schemas now hard-fail and render/codegen messaging is more trustworthy |
| Pipeline & Persistence | 15 | 14 | Artifact apply paths now reliable |
| Error Handling & DX | 10 | 10 | Better metadata and fewer trust-breaking runtime surprises |
| Visualization | 10 | 9 | Latest-dist viz path validates cleanly |
| Documentation & Discoverability | 5 | 4 | Retest docs updated; broader docs alignment still open |
| **Total** | **100** | **84** | |

## Latest Reports

| Date | Agent | Score | Scope | Report |
|------|-------|-------|-------|--------|
| 2026-03-06 | Codex GPT-5 | 84/100 | Sprint 76 latest-dist retest | `cmos/reports/s76-retest-latest-dist.md` |
| 2026-03-06 | Codex GPT-5 | 75/100 | Sprint 75 latest-dist retest | `cmos/reports/s75-m05-latest-dist-retest-2026-03-06.md` |
| 2026-03-06 | Codex GPT-5 | 6.5/10 UX | Full user test | `cmos/reports/oods-foundry-mcp-full-user-test-2026-03-06-codex.md` |
| 2026-03-05 | Claude Opus 4.6 | 68/100 | E2E retest | `cmos/reports/oods-foundry-mcp-e2e-retest-2026-03-05.md` |

## Key Files

| Area | Files |
|------|-------|
| Composition engine | `packages/mcp-server/src/compose/object-slot-filler.ts`, `component-selector.ts`, `position-affinity.ts`, `field-affinity.ts`, `intent-sections.ts` |
| Dashboard layout | `packages/mcp-server/src/compose/templates/dashboard.ts`, `packages/mcp-server/src/tools/design.compose.ts` |
| Visualization | `packages/mcp-server/src/tools/viz.compose.ts` |
| Artifact tools | `packages/mcp-server/src/tools/reviewKit.create.ts`, `purity.audit.ts`, `vrt.run.ts` |
| Bridge tool surface | `packages/mcp-bridge/src/server.ts`, `packages/mcp-bridge/src/tool-surface.ts` |

The V1 path is now blocked by final composition-depth and documentation polish, not by latest-dist correctness failures.

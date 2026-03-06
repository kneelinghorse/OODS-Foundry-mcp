# OODS Foundry MCP — V1 Roadmap

> Updated: 2026-03-06 | Sprint 75 latest-dist retest `s75-m05`

## Current State

- **Platform Score:** 75/100 (targeted latest-dist retest)
- **Agent UX Score:** 8.0/10
- **Compose Quality:** 3.4/5
- **Retest Coverage:** 5/5 Sprint 75 regression lanes passed on rebuilt dist
- **Critical Runtime Defects Open:** 0 in the Sprint 75 retest set

## Validated Release Gates

| Gate | Status | Sprint | Evidence |
|------|--------|--------|----------|
| Registry-safe object compose | Pass | S75 | `Product` list compose validates and no longer emits `ActiveFilterChips` |
| Viz schemas valid on latest dist | Pass | S75 | Manual and object-backed `viz.compose` both validate with root `Stack` |
| Artifact tools succeed on first apply run | Pass | S75 | `reviewKit.create`, `purity.audit`, and `vrt.run` all write artifact bundles |
| Bridge `/tools` matches enabled tool surface | Pass | S75 | `default` exposes 15 tools, `all` exposes 24, both from `dist/tools/registry.json` |
| Long dashboard intents scale past fixed 4-slot layout | Pass | S75 | Section-heavy dashboard prompt yields expanded `main-section-*` and `sidebar-*` regions |
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

## Carry-Forward Backlog

### P1 — Composition Quality

| Item | Latest evidence | Notes |
|------|-----------------|-------|
| Form field differentiation | Previously validated and still unaddressed | Settings-like forms still need field-type → component mapping, not generic editors everywhere |
| SearchInput vs Input disambiguation | Previously validated and still unaddressed | Search slots still need stronger ranking bias toward `SearchInput` |
| Object auto-detection overreach in long intents | Latest retest auto-detected `Plan` from `plan downgrade anomalies` | Tighten object inference to require stronger multi-signal matches |
| Dashboard object view extension depth | Latest retest still produced `OODS-V119` for dashboard context on auto-detected object | Add dashboard view_extensions or suppress incidental object attachment |

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
| Composition Intelligence | 25 | 16 | Dashboard expansion improved; semantic slot/component quality still mixed |
| Code Generation Quality | 20 | 8 | No Sprint 75 regressions, but binding quality still needs work |
| Pipeline & Persistence | 15 | 14 | Artifact apply paths now reliable |
| Error Handling & DX | 10 | 10 | Better metadata and fewer trust-breaking runtime surprises |
| Visualization | 10 | 9 | Latest-dist viz path validates cleanly |
| Documentation & Discoverability | 5 | 4 | Retest docs updated; broader docs alignment still open |
| **Total** | **100** | **75** | |

## Latest Reports

| Date | Agent | Score | Scope | Report |
|------|-------|-------|-------|--------|
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

The V1 path is now blocked by composition quality work, not by latest-dist correctness failures.

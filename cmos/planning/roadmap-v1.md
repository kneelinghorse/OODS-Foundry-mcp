# OODS Foundry MCP — V1 Roadmap

> Updated: 2026-03-05 | Sprint 74 Planning Session PS-2026-03-05-021

## Current State (Post-Sprint 73)

- **Platform Score:** 68/100 (target: 83/100 for V1)
- **Agent UX Score:** 7.5/10
- **Compose Quality:** 2.3/5 (target: 4.5/5)
- **Test Tasks Passing:** 25/25 (first clean run)
- **Test Count:** 1479 passing

### V1 Release Gates

| Gate | Status | Sprint |
|------|--------|--------|
| Mapping CRUD executable from MCP | Pass | S73 |
| E2E script copy/paste accurate | **Fail** | S74-M04 |
| Schema persistence metadata integrity | Pass | S73 |
| Pipeline save supports tags | **Fail** | S74-M05 |
| Error messages actionable | Pass | S73 |
| End-to-end compose/validate/render/codegen | Pass | S65 |

---

## Sprint 74 — Semantic Fidelity (Active)

**Focus:** Close selection-to-tree gap, bind props in codegen, fix contracts.
**Target:** 78-83/100 platform, 3.5/5 compose quality.

| Mission | Name | Theme | Depends |
|---------|------|-------|---------|
| s74-m01 | Selection→Tree Bridge | Composition Quality | — |
| s74-m02 | Slot Content Distributor | Composition Quality | s74-m01 |
| s74-m03 | Codegen Prop Binder | Code Generation | — |
| s74-m04 | Test Script Contract Alignment | Contract/DX | — |
| s74-m05 | Pipeline Save Tags | Contract/DX | — |
| s74-m06 | Viz Object Auto-Binding | Visualization | — |

### Parallel Lanes
- **Lane A (Composition):** M01 → M02 (sequential)
- **Lane B (Codegen):** M03 (independent)
- **Lane C (Contracts):** M04, M05, M06 (independent, parallelizable)

---

## Sprint 75+ Backlog (Prioritized)

### P1 — Quality

| Item | Evidence | Notes |
|------|----------|-------|
| Form field differentiation | Settings form: all fields become PreferenceEditor regardless of toggle/dropdown intent | Need field-type→component mapping for form context |
| SearchInput vs Input disambiguation | User list: SearchInput ranked 3rd at 0.61, Input used | component-selector should prefer SearchInput for search slots |
| Dashboard layout slot scaling | 500-word intent with 7 sections → 4 generic slots | Dashboard template needs intent-section parsing |
| Long-intent section parsing | Long intents collapse to single layout | Parse intent paragraphs into distinct layout regions |

### P2 — Platform Polish

| Item | Evidence | Notes |
|------|----------|-------|
| SchemaRef TTL documentation | 30-min TTL visible in responses but undocumented | Add to tool descriptions + consider auto-extend |
| `apply` pattern consistency | map.create uses for persistence, repl.render for output | Resolve semantic ambiguity |
| Compact mode for repl.render + code.generate | Currently only pipeline has compact | Add `compact` option to other tools |
| Trait name format docs for map.create | `behavioral/Searchable` vs `Searchable` warns | Document expected format |

### P3 — Future Capabilities

| Item | Notes |
|------|-------|
| Multi-object composition | Compose views that combine fields from multiple objects |
| Layout template authoring | Let users define custom layout templates |
| Codegen framework plugins | Extensible emitter system for Svelte, Angular, etc. |
| Real-time schema editing | Patch-based incremental schema updates |
| Brand-aware composition | Compose different component variants per brand |

---

## Scoring Breakdown (How to reach 83/100)

| Category | Weight | Current | S74 Target | Gap Closure |
|----------|--------|---------|------------|-------------|
| API Surface Completeness | 15 | 13 | 14 | M04 contract alignment |
| Composition Intelligence | 25 | 10 | 16 | M01 selection→tree, M02 slot distributor |
| Code Generation Quality | 20 | 8 | 14 | M03 prop binder |
| Pipeline & Persistence | 15 | 13 | 15 | M05 pipeline tags |
| Error Handling & DX | 10 | 9 | 9 | Maintained |
| Visualization | 10 | 3 | 6 | M06 viz auto-binding |
| Documentation & Discoverability | 5 | 3 | 4 | M04 script alignment |
| **Total** | **100** | **68** | **78-83** | |

---

## Agent Test Prompt Reports

| Date | Agent | Score | Tasks | Report |
|------|-------|-------|-------|--------|
| 2026-03-05 | Claude Opus 4.6 | 68/100 | 25/25 | `cmos/reports/oods-foundry-mcp-e2e-retest-2026-03-05.md` |
| 2026-03-05 | Codex GPT-5 | ~65/100 | 22/25 | `cmos/reports/oods-foundry-mcp-e2e-test-2026-03-05-codex-retest.md` |

After Sprint 74, re-run the agent test prompt (use updated `cmos/reports/agent-test-prompt-sprint74.md` from M04) and score against 83/100 target.

---

## Key Architectural Files

| Area | Files |
|------|-------|
| Composition engine | `src/compose/object-slot-filler.ts`, `component-selector.ts`, `position-affinity.ts`, `field-affinity.ts` |
| Slot expansion | `src/compose/slot-expander.ts`, `view-extension-collector.ts`, `slot-patterns.ts` |
| Code generation | `src/codegen/react-emitter.ts`, `vue-emitter.ts`, `html-emitter.ts`, `binding-utils.ts` |
| Visualization | `src/compose/viz-trait-resolver.ts`, `src/tools/viz.compose.ts` |
| Pipeline | `src/tools/pipeline.ts`, `src/schemas/pipeline.input.json` |
| Schemas | `src/schemas/*.input.json`, `src/schemas/*.output.json` |

All paths relative to `packages/mcp-server/`.

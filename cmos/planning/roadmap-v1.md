# OODS Foundry MCP — V1 Roadmap

> Updated: 2026-04-15 | Sprint 87 complete

## Current State

- **Platform Score:** 100/100 (Sprint 83 confirmed — all V1 categories at full marks)
- **Agent UX Score:** 8.7/10
- **Compose Quality:** 4.2/5
- **Test Suite:** 123 files, 2019 tests, 0 failures (mcp-server)
- **Build:** pnpm build clean, dist rebuilt
- **Critical Runtime Defects Open:** 0
- **Stage1 Integration:** Contract v1.1.0 — action_candidates pathway documented, trait actions receiver side live

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
| Bridge output schema aligned | Pass | S78 | `intentSectionsParsed` and `sectionContextUsed` now in bridge output schema |
| Codegen prop enrichment | Pass | S78 | Form fields emit label/placeholder/type/options from object metadata and intent parsing |
| Cross-framework codegen parity | Pass | S78 | React, Vue, HTML emitters validated across 3 schemas × 3 styling modes |
| Intent-driven form differentiation | Pass | S78 | Settings form `dropdown` keyword maps to `Select` via `fieldHintToSlotIntent` |
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

## Sprint 79 Validated Changes

| Mission | Change | Status | Evidence |
|---------|--------|--------|----------|
| `s79-m01` | Codegen prop-binding accuracy: resolveFieldProps() enriches emitted components with labels, placeholders, required, input types, enum options from objectSchema | Done | 13 new tests in prop-binding.spec.ts, 0 regressions |
| `s79-m02` | Cross-framework parity: section layout binding fix (React+Vue), 28-test parity suite | Done | cross-framework-parity.spec.ts verifies nested children, sidebar, section, field injection, event bindings, prop enrichment, token overrides across all 3 frameworks |
| `s79-m03` | Styling mode 3×3 matrix: 54 tests covering React/Vue/HTML × inline/tokens/tailwind | Done | styling-mode-coverage.spec.ts — all 9 combos pass on first run |
| `s79-m04` | Latest-dist retest + score refresh: build clean, 107 files / 1698 tests / 0 failures | Done | Score: 89/100 (Codegen Quality 13→17) |

## Sprint 80 Validated Changes

| Mission | Change | Status | Evidence |
|---------|--------|--------|----------|
| `s80-m01` | Intent synonyms & paraphrase: 80+ word synonyms, 3-tier resolution (exact→phrase-pattern→word-level) integrated into component-selector via resolveIntent() | Done | 35 new tests in intent-synonyms.spec.ts, paraphrased intents resolve to canonical INTENT_MAP keys |
| `s80-m02` | Multi-field semantic patterns: 8 PatternRule definitions (status-timeline, pricing-summary, user-identity, address-block, date-range, metric-trend, contact-info, dimensions) | Done | 20 new tests in field-patterns.spec.ts. Metadata-only — detectedPatterns on ExpansionResult, no slot grouping changes |
| `s80-m03` | Confidence-aware composition: rawConfidence on SelectionResult, per-slot confidence, alternativeCandidates for low-confidence slots (<0.5), compositionConfidence in intelligence metadata | Done | 10 new tests in confidence-scoring.spec.ts, updated design.compose.output.json schema |
| `s80-m04` | Vue 3 Composition API reactivity: ref() for form fields, computed() for derived values, v-model on Input/Select/Textarea/Toggle, JSDoc from descriptions | Done | 12 new tests in vue-reactivity.spec.ts, cross-framework parity maintained |
| `s80-m05` | Responsive Tailwind variants: responsiveLayoutClasses() for mobile-first grid/sidebar/inline breakpoints, CVA size variants with responsive prefixes | Done | 20 new tests in responsive-tailwind.spec.ts, applied to React and Vue emitters |
| `s80-m06` | Retest + score refresh: build clean, 113 files / 1809 tests / 0 failures | Done | Score: 96/100 (Composition Intelligence 20→23, Codegen Quality 17→20, Pipeline 14→15) |

## Sprint 81 Validated Changes

| Mission | Change | Status | Evidence |
|---------|--------|--------|----------|
| `s81-m01` | Contract fidelity: pipeline.save accepts documented string and {name, tags} forms, mapping response contract alignment | Done | Targeted contract/integration tests, updated docs/examples |
| `s81-m02` | Example payload + pipeline coverage: fixed stale mapping examples, added pipeline framework/typescript option handling tests | Done | Pipeline tests covering framework selection and options.typescript/options.framework behavior |
| `s81-m03` | Composition explainability: confidenceLevel, explanation, reviewHint on selections; lowConfidenceSlotNames in intelligence metadata | Done | Tests covering high-confidence rationale and ambiguous low-confidence cases |
| `s81-m04` | Override + escape hatch guidance: copyable componentOverrides example in docs, pipeline preferences passthrough | Done | Automated test for override behavior in compose/pipeline flows |
| `s81-m05` | Fresh-build retest + feedback closure report | Done | Report at cmos/reports/s81-m05-public-beta-trust-polish-closure-2026-03-06.md |

## Sprint 82 Validated Changes

| Mission | Change | Status | Evidence |
|---------|--------|--------|----------|
| `s82-m01` | CMOS project registration + cross-project messaging with Stage1 operational | Done | Message exchange verified, project visible in CMOS directory |
| `s82-m02` | Stage1→OODS integration contract: artifact→tool mapping, 2 worked examples, token path translation, confidence gating | Done | `docs/integration/stage1-oods-contract.md` — all 5 open questions now resolved by Stage1 |
| `s82-m03` | map.create metadata field doc fix + adapter tool-description alignment | Done | Tool-Specs.md and tool-descriptions.json updated |
| `s82-m04` | Master context condensation: 79.1% → 41.4% capacity | Done | Collapsed per-mission entries to sprint summaries, deduplicated learnings |
| `s82-m05` | 3 brand presets (Corporate Blue, Startup Warm, Dark Minimal) + theming guide | Done | `packages/tokens/src/presets/`, `docs/theming.md` |
| `s82-m06` | Composition intelligence field-affinity improvements (stretch) | Done | Field-affinity tests updated, 114 files / 1,840 tests / 0 failures |

## Sprint 83 Validated Changes (100/100 confirmed)

| Mission | Change | Status | Evidence |
|---------|--------|--------|----------|
| `s83-m01` | Composition Intelligence 23→25: pattern-driven slot grouping with confidence ≥0.7 threshold, contact-info regex fix | Done | Phase 0 pre-assignment in slot-expander, 115 files / 1899 tests |
| `s83-m02` | API Surface 14→15: propMappings sub-property docs in map-create.md | Done | Tool-Specs.md and map-create.md updated |
| `s83-m03` | Visualization 9→10: scatter + heatmap chart types, opacity + shape encoding channels, 8 new viz components | Done | viz-trait-resolver tests, component registry updated |
| `s83-m04` | Stage1 Bridge Integration Test: 29 tests covering ORCA payloads, token pipeline, confidence gating, evidence chain | Done | test/contracts/stage1-integration.spec.ts |
| `s83-m05` | Retest + Score Refresh: build clean, 115 files / 1899 tests / 0 failures | Done | Platform Score: 100/100 |

## Sprint 84 Validated Changes

| Mission | Change | Status | Evidence |
|---------|--------|--------|----------|
| `s84-m01` | .oodsrc project-level configuration: JSON config file loader with fallback resolution in pipeline/compose/codegen | Done | 18 tests in oodsrc.test.ts, docs in Tool-Specs.md |
| `s84-m02` | data-oods-confidence affordance: confidence in rendered HTML via opt-in data attributes + low-confidence CSS class | Done | 15 tests in confidence-affordance.spec.ts, opt-in via output.showConfidence |
| `s84-m03` | propMappings v2.1.0 compatibility: ORCA inferred props audit, orca-prop-compat.ts helper, 3 new integration tests | Done | 15 unit tests + 32 integration tests (was 29), contract doc updated |
| `s84-m04` | Context & roadmap refresh: roadmap updated, 18→5 next-steps pruned, contract doc v2.1.0 status | Done | Context: master 62%, project 14% |
| `s84-m05` | Retest + build verification: build clean, 118 files / 1950 tests / 0 failures | Done | Platform Score: 100/100 maintained |

## Sprint 85 Validated Changes

| Mission | Change | Status | Evidence |
|---------|--------|--------|----------|
| `s85-m01` | Dark mode fix + pipeline DX: --sys-* semantic tokens in component CSS, [data-theme="dark"] override block, WCAG AA text-muted fix, themes[] on brand.apply, fieldsOmitted metric, form Button defaults | Done | 119 files, 1959 tests, 0 failures; 7 deliverables verified |
| `s85-m02` | Playground app scaffold: Vite + React + TS under apps/playground/, Tailwind CSS, bridge HTTP client, layout shell with selectors | Done | TypeScript strict, Vite build 207KB JS + 11.7KB CSS |
| `s85-m03` | Live compose + render preview: pipeline wiring, theme switching in iframe, confidence overlays, error display | Done | Preview updates within 400ms debounce, dark theme validated |
| `s85-m04` | Code gen panel + starters: syntax highlighting, framework switching, 8 starter prompts, save schema, download HTML | Done | Zero-dep highlighter, copy-to-clipboard, export buttons |
| `s85-m05` | Carry-forward + retest: stale next-steps pruned, roadmap updated, build clean, all tests pass | Done | 119 files, 1959 tests, 0 failures |

## Sprint 86 Validated Changes

| Mission | Change | Status | Evidence |
|---------|--------|--------|----------|
| `s86-m01` | Semantic tab labels: wired generateLabels() into design.compose pipeline for object-aware detail layouts | Done | Tab labels derived from trait categories (e.g., "Billing", "Status & History") instead of "Tab 1/2/3". 3 new tests |
| `s86-m02` | Card + Timeline layout templates: first-class layout types with context-appropriate structure | Done | Card: compact 3-slot (header/body/footer, no tabs). Timeline: header + N chronological entry slots. 24 new tests |
| `s86-m03` | SchemaRef TTL proactive warning: computeTtlWarning() utility + pipeline integration | Done | Warning emitted when TTL < 5 minutes with actionable recommendation. 9 new tests |
| `s86-m04` | BUG-7 viz metadata fix: chartType-only path now populates traitsResolved/encodingsApplied | Done | Synthetic trait derivation from chartType + dataBindings channels. All 6 chart types verified. 10 new tests |
| `s86-m05` | Retest gate: build clean, 122 files / 2005 tests / 0 failures | Done | +46 tests from 1959 baseline |

## Sprint 87 Validated Changes

| Mission | Change | Status | Evidence |
|---------|--------|--------|----------|
| `s87-m01` | Trait Actions Loader: `state_machine` and `actions` fields wired through full stack — `StateMachineDefinition`/`TraitAction` types added to types.ts, normalize() updated in trait-loader.ts, `objectUsed.traitStateMachines`/`traitActions` exposed in design.compose, collect_traits() updated in refresh_structured_data.py | Done | 14 new tests in trait-loader.test.ts, 2 viz traits (InteractionHighlight, InteractionTooltip) now surface state machines end-to-end |
| `s87-m02` | Stage1 Sprint 38 readiness: action_candidates serialization confirmed complete, contract updated to v1.1.0 with §2b (action_candidates pathway), capability→trait clarification | Done | `docs/integration/stage1-oods-contract.md` v1.1.0 |
| `s87-m03` | CMOS housekeeping: next_steps pruned (5 stale items dropped), sprint-70 closed (was Planned with 6/6 missions done), PG sync backfill started, stale learning reviewed | Done | Context at 54%, sprint-70 now Completed |
| `s87-m04` | Retest gate + roadmap update: fresh vitest run, roadmap updated | Done | 123 files, 2019 tests, 0 failures |

## Carry-Forward Backlog

### P1 — Composition Quality

| Item | Latest evidence | Notes |
|------|-----------------|-------|
| Form field differentiation latest-dist score refresh | `s77-m02` latest-dist validation now confirms `enum-input` → `Select`, `boolean-input` → `Checkbox`, `date-input` → `DatePicker`, and `long-text-input` → `Textarea` on the representative `Subscription` form path | Watchlist narrowed to planned billing form widgets that still emit `OODS-V120`; see `cmos/reports/s77-m02-form-differentiation-revalidation-2026-03-06.md` |
| Dashboard object view extension depth | Closed by `s77-m01`: source tests + latest-dist validation now project `PriceSummary`, `StatusTimeline`, `StatusBadge`, and `CancellationSummary` for the representative `Subscription` dashboard path without `OODS-V119` | See `cmos/reports/s77-m01-object-dashboard-depth-2026-03-06.md` |
| Toolbar/secondary placement semantics beyond current list cases | Closed by `s77-m03`: `Subscription` list now emits no `OODS-V120` on source or latest dist while retaining `Button` as the primary toolbar control and `PriceBadge` as colocated secondary summary content | Expanded placement coverage now includes explicit target-slot detail behavior plus dashboard projection evidence; see `cmos/reports/s77-m03-placement-semantics-expansion-2026-03-06.md` |

### P2 — Platform Polish

| Item | Notes |
|------|-------|
| SchemaRef TTL documentation | Closed by `s77-m04`: README + MCP docs now document the 30-minute TTL and the `schema.save` / `schema.load` persistence path; see `cmos/reports/s77-m04-docs-tool-surface-alignment-2026-03-06.md` |
| `apply` pattern consistency | Documentation gap closed by `s77-m04`: README + MCP docs now explain per-tool apply behavior, including apply-gated `repl.render` output; runtime ergonomics still vary by tool family |
| Compact mode outside pipeline | Documentation gap closed by `s77-m04`: docs now distinguish `pipeline` compact-by-default behavior from `repl.render` opt-in compact mode; runtime ergonomics still differ |
| Trait-name format docs for mapping | Closed by `s77-m04`: README + MCP docs now distinguish structured-data trait names, namespaced object traits, and viz trait ids; see `cmos/reports/s77-m04-docs-tool-surface-alignment-2026-03-06.md` |

## Score Snapshot

| Category | Weight | Current | Notes |
|----------|--------|---------|-------|
| API Surface Completeness | 15 | 15 | S83: propMappings sub-property docs (map-create.md), bridge tool-surface honesty (S81), pipeline save tags (S81) |
| Composition Intelligence | 25 | 25 | S83: pattern-driven slot grouping (confidence ≥0.7 threshold, Phase 0 pre-assignment), contact-info regex fix. S80: intent synonyms, multi-field semantic patterns, confidence-aware composition. S81: explainability polish |
| Code Generation Quality | 20 | 20 | S80: Vue 3 Composition API reactivity (ref, computed, v-model), responsive Tailwind variants (mobile-first breakpoints, CVA size variants). All 9 framework×styling combos validated |
| Pipeline & Persistence | 15 | 15 | S81: contract fidelity (pipeline.save dual forms, mapping contract alignment), pipeline framework/typescript option handling |
| Error Handling & DX | 10 | 10 | S81: composition explainability, override guidance, escape hatch documentation |
| Visualization | 10 | 10 | S83: scatter+heatmap chart types, opacity+shape encoding channels, 8 new viz components registered |
| Documentation & Discoverability | 5 | 5 | README + MCP docs aligned, override examples added, confidence/explainability documented |
| **Total** | **100** | **100** | |

## Latest Reports

| Date | Agent | Score | Scope | Report |
|------|-------|-------|-------|--------|
| 2026-03-10 | Claude Opus 4.6 | 96/100 | Sprint 81 retest — Composition Intelligence 20→23, Codegen Quality 17→20, Pipeline 14→15 | `s80-m06` build+test gate |
| 2026-03-06 | Claude Opus 4.6 | 89/100 | Sprint 79 retest — Codegen Quality 13→17 | `s79-m04` build+test gate |
| 2026-03-06 | Codex GPT-5 | 84/100 | Sprint 76 latest-dist retest | `cmos/reports/s76-retest-latest-dist.md` |
| 2026-03-06 | Codex GPT-5 | Docs aligned | README + MCP tool-surface alignment | `cmos/reports/s77-m04-docs-tool-surface-alignment-2026-03-06.md` |
| 2026-03-06 | Codex GPT-5 | 75/100 | Sprint 75 latest-dist retest | `cmos/reports/s75-m05-latest-dist-retest-2026-03-06.md` |
| 2026-03-06 | Codex GPT-5 | 6.5/10 UX | Full user test | `cmos/reports/oods-foundry-mcp-full-user-test-2026-03-06-codex.md` |
| 2026-03-05 | Claude Opus 4.6 | 68/100 | E2E retest | `cmos/reports/oods-foundry-mcp-e2e-retest-2026-03-05.md` |

## Key Files

| Area | Files |
|------|-------|
| Composition engine | `packages/mcp-server/src/compose/object-slot-filler.ts`, `component-selector.ts`, `position-affinity.ts`, `field-affinity.ts`, `intent-sections.ts` |
| Layout templates | `packages/mcp-server/src/compose/templates/dashboard.ts`, `detail.ts`, `form.ts`, `list.ts`, `card.ts`, `timeline.ts` |
| Visualization | `packages/mcp-server/src/tools/viz.compose.ts` |
| Artifact tools | `packages/mcp-server/src/tools/reviewKit.create.ts`, `purity.audit.ts`, `vrt.run.ts` |
| Bridge tool surface | `packages/mcp-bridge/src/server.ts`, `packages/mcp-bridge/src/tool-surface.ts` |

All V1 categories at full score (100/100). S86 fixes composition quality gaps reported by external agent testing: semantic tab labels, card/timeline layouts, schemaRef TTL warnings, and BUG-7 viz metadata. 122 files, 2005 tests, 0 failures.

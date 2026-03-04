# OODS Foundry MCP — Full User Test
**Date:** 2026-03-04
**Tester:** Codex (GPT-5)
**Scope:** End-to-end user test across the OODS Foundry MCP tool surface, focusing on correctness, UX friction, and data quality.

---

**Executive Summary**
The MCP pipeline is coherent and largely usable, but there are still critical defects blocking production use. The largest regression is `tokens_build(apply=true)` producing a stub file (brand/theme only) and omitting expected artifacts, which blocks token compilation. Intent-based composition still ignores domain components and overrides are not materialized into the schema, so output code remains generic. Layout alignment also maps incorrectly in render/code generation (`align-items: space-between`), causing invalid CSS. A11y findings are consistent in `repl_validate` and `a11y_scan`, but conflict with `diag_snapshot` (reports AA pass 100%).

---

**Tools Exercised**
- `catalog_list` (summary, full detail, filters, pagination)
- `structuredData_fetch` (manifest + ETag caching, tokens listVersions + version fetch, components listVersions)
- `design_compose` (detail, dashboard, form; with and without componentOverrides)
- `repl_validate` (full + a11y, patch mode with schemaRef only)
- `repl_render` (full render, document output)
- `code_generate` (React TSX, Vue SFC, HTML)
- `brand_apply` (alias + patch strategies, preview)
- `tokens_build` (preview + apply)
- `map_list`, `map_resolve`
- `a11y_scan`
- `diag_snapshot`
- `purity_audit`
- `reviewKit_create` (failed, missing build)
- `billing_reviewKit`
- `billing_switchFixtures`
- `release_verify` (blocked by role)
- `release_tag` (blocked by role)
- `vrt_run`

---

**What Worked Well**
- `structuredData_fetch` ETag caching behaves correctly. A `matched=true` response returns metadata without payload.
- `brand_apply` now supports RFC 6902 patch arrays as advertised.
- `billing_reviewKit` produces a structured before/after diff and specimens when the correct object enum is used.
- `map_list` and `map_resolve` return consistent mappings and translations.

---

**P0 — Critical Defects**

**BUG-01: `tokens_build(apply=true)` writes a stub file and omits artifacts**
- Preview reports 4 artifacts, but apply writes only `tokens.light.json`.
- The output file contains only `{ "brand": "A", "theme": "light" }` (size 38 bytes).
- Affects: `tokens_build` for brand A / light theme.
- Output file: `OODS-Foundry-mcp/artifacts/current-state/2026-03-04/tokens.build/tokens.light.json`

Repro:
1. Call `tokens_build(brand="A", theme="light", apply=false)` → preview lists 4 artifacts.
2. Call `tokens_build(brand="A", theme="light", apply=true)` → only one file written.
3. Inspect `tokens.light.json` → stub content only.

Impact: Blocks token compilation for all downstream rendering and codegen.

---

**P1 — High-Impact Defects**

**BUG-02: Layout align mapping generates invalid CSS**
- In `repl_render` HTML and `code_generate` outputs, inline layouts use `align-items: space-between`.
- `space-between` is invalid for `align-items` and ignored by browsers.
- Also appears for `align: end` (maps to `align-items: flex-end` instead of `justify-content`).

Repro:
1. Compose any layout with `layout.type=inline` and `align: space-between`.
2. Render HTML or codegen → inline style uses `align-items: space-between`.

Impact: Breaks horizontal alignment in generated UI.

**BUG-03: `componentOverrides` do not materialize in the schema**
- `design_compose` returns selections showing overrides, but the schema tree still contains generic `Stack`/`Text` slots.
- Code generation and render outputs ignore the overrides.

Repro:
1. Call `design_compose` with `preferences.componentOverrides` for tab slots.
2. Inspect schema nodes → slots remain `Stack`/`Text`.
3. `code_generate` uses only generic components.

Impact: Overrides are UX-dead and cannot influence output.

**BUG-04: `design_compose` intent binding ignores domain components**
- Detail, dashboard, and form intents all select generic components (`Card`, `Stack`, `Input`) even with domain-specific intent.
- Examples: membership panel, cycle progress, billing timeline, address editor, and tag inputs are never selected.

Impact: Intent-to-component resolution does not leverage catalog tags/traits.

**BUG-05: `repl_validate` patch mode requires `baseTree` even with `schemaRef`**
- Patch mode with only `schemaRef` returns `MISSING_BASE_TREE`.

Repro:
1. Call `repl_validate(mode="patch", schemaRef=..., patch=[...])`.
2. Error: `baseTree is required when mode=patch`.

Impact: `schemaRef` cannot be used as implicit base tree, increasing payload size and friction.

**BUG-06: A11y results conflict between tools**
- `a11y_scan` reports WCAG AA failure for `sys.text.muted` on `sys.surface.canvas` (contrast 2.68:1).
- `diag_snapshot` summary reports “Brand A AA pass 100%”.

Impact: Conflicting compliance signals undermine trust in diagnostics.

---

**P2 — Functional / UX Defects**

**BUG-07: `repl_render` ignores `includeCss=false`**
- Render output still includes full token CSS and component CSS even when `includeCss=false` is supplied.

Impact: Large outputs regardless of settings; weakens document vs fragment use cases.

**BUG-08: `reviewKit_create` fails without build and offers no auto-recovery**
- Error: missing `/reviewKit.create/review-kit.txt` with a manual fix instruction.

Impact: Tool is unusable in a fresh environment without a manual build step.

**BUG-09: Tabs and slots render as empty containers**
- Tabs render without a visible header or tablist UI.
- Slot placeholders are empty divs without visual labels.

Impact: Preview renders are visually uninformative and misleading during design exploration.

---

**P3 — Data Quality Issues**

**DQ-01: Duplicate traits in catalog**
- `StatusBadge` lists duplicate traits (`Stateful`, `Statusable` repeated).

**DQ-02: Communication components missing region data**
- `CommunicationDetailPanel`, `MessageEventTimeline`, `MessageStatusBadge` return empty `regions: []`.

**DQ-03: `catalog_list` stats are global, not filtered**
- Filtering by category returns 10 components but `stats.componentCount` remains `94`.

---

**UX / DX Friction**
- Tool parameter enums are case-sensitive without normalization (`billing_reviewKit` rejected `invoice`; accepts `Invoice`).
- `release_verify` and `release_tag` are listed but blocked by role “designer”, producing hard errors.
- `purity_audit` and `vrt_run` return no summary or findings, making them hard to interpret.
- `repl_render` requires `mode=full|patch` while `output.format=document|fragments`, causing confusion if you try `mode=document`.
- `code_generate(framework="html")` output is identical to `repl_render` and includes full token CSS; no option to generate a lightweight fragment.

---

**Suggestions / Enhancements**
- Fix `tokens_build(apply=true)` to emit all artifacts and write full compiled token payloads.
- Change inline alignment mapping: `align` should map to `justify-content` for row layouts.
- Materialize `componentOverrides` into the schema tree so overrides appear in render/codegen.
- Improve intent resolution by using catalog tags/traits and tab labels as strong signals.
- Allow `schemaRef` to serve as implicit `baseTree` in patch validation.
- Align a11y reporting between `a11y_scan`, `repl_validate`, and `diag_snapshot`.
- Respect `includeCss=false` to allow smaller document outputs.
- Provide visible placeholder content for slots in preview renders.
- Add a short summary payload for `purity_audit` and `vrt_run`.
- Normalize case for enum inputs like `billing_reviewKit.object`.
- Surface permission gating in tool metadata so “designer-only” tools are not callable by default.

---

**Artifacts Created During Testing**
- Tokens build bundle: `OODS-Foundry-mcp/artifacts/current-state/2026-03-04/tokens.build/`
- A11y scan bundle: `OODS-Foundry-mcp/artifacts/current-state/2026-03-04/a11y.scan/`
- Diag snapshot bundle: `OODS-Foundry-mcp/artifacts/current-state/2026-03-04/diag.snapshot/`
- Brand apply bundle: `OODS-Foundry-mcp/artifacts/current-state/2026-03-04/review-kit/brand.apply/`
- Billing review kit: `OODS-Foundry-mcp/artifacts/current-state/2026-03-04/billing.reviewKit/`
- Billing switch fixtures: `OODS-Foundry-mcp/artifacts/current-state/2026-03-04/billing.switchFixtures/`
- VRT run bundle: `OODS-Foundry-mcp/artifacts/current-state/2026-03-04/vrt.run/`

---

**Overall Assessment**
The architecture is promising and several tools provide rich, structured feedback. However, the current state still blocks real usage due to the token build failure and the schema/materialization gaps in composition. If those are resolved, the system is very close to being genuinely productive for UI exploration and codegen.

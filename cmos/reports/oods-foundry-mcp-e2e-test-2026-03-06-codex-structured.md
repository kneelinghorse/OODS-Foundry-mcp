# OODS Foundry MCP Structured E2E Test Report

**Date:** 2026-03-06
**Tester:** Codex GPT-5
**Test Script:** `oods-mcp-e2e-test-script.md`
**Server Version:** `0.1.0`
**DSL:** `1.0` with `2026.02` payloads
**CMOS Session:** `PS-2026-03-06-002`

## Build Provenance Check

After the initial run, I verified the local build state to rule out a stale `dist` explanation.

- Latest repo commit: `994be9b8d817024d778b00ac57355e968abcb4ed` on `2026-03-06 00:48:37 -0600`
- `packages/mcp-server/dist/index.js` timestamp: `2026-03-06 07:21:55`
- `packages/mcp-server/dist/tools/map.create.js` timestamp: `2026-03-06 07:21:55`
- Relevant `src` and `dist` files had no uncommitted diffs against `HEAD`
- Local `dist` explicitly includes `map.create`, `map.resolve`, `map.delete`, and `map.update`

Conclusion:

- The local OODS Foundry MCP build in the repo does **not** look stale.
- The specific `map.create` gap I hit is more consistent with a **tool-registration / harness-surface mismatch** than with an out-of-date local `dist`.
- That means the low score is **not** explained by “old local build” alone. Most of the score loss came from real semantic composition weakness and invalid React/Vue code generation, plus the fact that the callable tool surface in this test harness lagged the local build.

## Executive Summary

The discovery, validation/render, pipeline save/load/delete, and visualization flows are broadly working. The largest remaining problems are semantic quality in composition, invalid React/Vue code generation, and a mapping-phase contract mismatch between the published prompt/docs and the callable tool surface available in this test harness.

**Strict script result:** `20/25` tasks passed as written.

## Completion Scorecard

| Phase | Tasks | Passed | Failed | Notes |
|---|---:|---:|---:|---|
| 1. Discovery | 3 | 3 | 0 | Health, objects, catalog all matched prompt expectations |
| 2. Composition | 3 | 3 | 0 | Payloads worked, but semantic output quality is weak |
| 3. Validation & Render | 2 | 2 | 0 | `schemaRef`-only calls work; compact render returns `tokenCssRef` |
| 4. Code Generation | 3 | 1 | 2 | HTML passes; React and Vue output appear invalid/non-compilable |
| 5. Pipeline | 2 | 2 | 0 | Steps and save object work; generated UI remains semantically poor |
| 6. Schema Persistence | 3 | 3 | 0 | Save/load/list/delete all worked; tags preserved |
| 7. Visualization | 2 | 2 | 0 | `data` alias works; object-based line chart auto-bound useful fields |
| 8. Mappings | 3 | 0 | 3 | `map.create` unavailable in callable surface; prompt payloads also drift from current schema |
| 9. Edge Cases | 4 | 4 | 0 | Invalid object/schemaRef and long intent behave well; empty intent errors at validation layer |
| **Total** | **25** | **20** | **5** | 3 additional mapping behaviors were verified only via recovery |

## Key Findings

- `repl.validate`, `repl.render`, `viz.compose(data=...)`, and `pipeline(save={ name, tags })` all behaved in line with the Sprint 74 contract notes.
- Composition still over-indexes on generic keyword matches. The Product detail view expanded to 8 tabs, but most tabs became generic `Badge` slots rather than a meaningful detail layout.
- React and Vue codegen both emitted output with obvious correctness issues: duplicate local identifiers and duplicate prop assignments.
- The mapping phase is currently blocked in this harness by tool-surface drift: docs and repo source say `map.create` is auto-registered, but it is not callable here.
- Persistence is solid. `transaction-receipt-v1` saved, loaded with `object: "Transaction"` and tags preserved, then deleted cleanly.

## Detailed Results

### Phase 1: Discovery

- `health({})` returned `status: "ok"` with `components: 101`, `traits: 41`, `objects: 11`.
- `object.list({})` returned `totalCount: 11`.
- `object.show({ name: "Product" })` returned full traits, schema, semantics, and `viewExtensions`.
- `catalog.list({})` returned `totalCount: 101` and `availableCategories`.
- `catalog.list({ category: "primitive" })` returned expected primitives including `Badge`, `Button`, `Card`, `Input`, `Tabs`, and `Text`.

### Phase 2: Composition

- Product detail compose returned `layout: "detail"` and a valid `schemaRef`, but the result is structurally inflated rather than semantically strong.
- The Product detail screen expanded to 8 tabs for 38 fields. Most tabs were populated with generic `Badge` components for fields like `sku`, `status`, `placeholder`, and `primary_category_path`.
- The Product detail compose also warned: `OODS-V120` for a missing slot matching `AuditTimeline` position `"bottom"`.
- User list compose returned `layout: "list"` and did include pagination metadata, but the body content did not match the requested `name`, `email`, and `role` focus.
- The User list selected `SearchInput` for the filters slot and injected unrelated `AddressSummaryBadge`, `PreferenceSummaryBadge`, and `RoleBadgeList` into toolbar actions.
- The no-object settings form returned `layout: "form"` and correctly omitted object metadata. It was acceptable structurally, though both toggles were rendered as `PreferenceEditor` with generic placeholders.

### Phase 3: Validation & Render

- `repl.validate({ schemaRef })` worked without `mode`, returning `status: "ok"` and `mode: "full"`.
- `repl.render({ schemaRef, apply: true })` worked without `mode`.
- Compact render returned `tokenCssRef: "tokens.build"` as expected.
- Render quality mirrors composition quality: valid HTML, weak semantics.

### Phase 4: Code Generation

#### React

The React generator produced a `PageProps` interface and destructured props, but the output appears invalid:

- It redeclared destructured prop names:
  - `const label = 'Tab 8';`
  - `const placeholder = 'Enter searchQuery';`
- It emitted duplicate JSX props, for example:
  - `<Badge ... label="..." label={inventoryStatus} />`
- It did not generate the expected `{name}` / `{price}` style bindings from the prompt; instead it mostly surfaced generic badge bindings.

#### Vue

The Vue generator produced `<script setup lang="ts">` and destructured `defineProps<Props>()`, but it has the same correctness issue:

- It redeclared `label` and `placeholder` after destructuring them from `defineProps<Props>()`.
- Template output also mirrors the generic badge-heavy schema rather than the requested Product detail intent.

#### HTML

- HTML generation passed the prompt expectations.
- Output included `data-bind` attributes and `[field]` placeholders.

### Phase 5: Pipeline

- The Organization pipeline returned steps `["compose","validate","render","codegen"]`.
- Compact render behavior worked as expected.
- The save-object pipeline also worked:
  - `saved: { name: "transaction-receipt-v1", version: 1 }`
- Output quality remains weak:
  - The Organization dashboard card prompt produced a dashboard populated with `AddressSummaryBadge`, `PreferenceSummaryBadge`, `CommunicationDetailPanel`, and `MembershipPanel`, which do not match the requested `plan tier`, `billing status`, and `member count` focus.

### Phase 6: Schema Persistence

- `schema.load({ name: "transaction-receipt-v1" })` returned a reusable `schemaRef`, `object: "Transaction"`, and preserved tags.
- `schema.list({})` included `transaction-receipt-v1`.
- `schema.list({ tags: ["receipt"] })` correctly filtered to `transaction-receipt-v1`.
- `schema.delete({ name: "transaction-receipt-v1" })` returned `deleted: true`.

### Phase 7: Visualization

- `viz.compose({ chartType: "bar", dataBindings: { x, y } })` passed.
- `viz.compose({ chartType: "bar", data: { x, y } })` also passed, confirming the alias.
- `viz.compose({ object: "Transaction", chartType: "line" })` was stronger than expected:
  - auto-bound `created_at` to x
  - auto-bound `unit_amount_cents` to y
  - added `tax_behavior` for color
  - added `risk_score` for size
- This phase is in better shape than composition/codegen.

### Phase 8: Mappings

This phase failed as written for three separate reasons:

1. `map.create` is not callable in the MCP tool surface available in this harness.
2. The prompt payload for `map.create` uses `propMappings` as an object, while the current JSON schema expects an array of `{ externalProp, oodsProp, coercion? }`.
3. The prompt payload for `map.delete` uses `{ externalSystem, externalComponent }`, while the documented/current tool expects `{ id }`.

Recovery verification:

- I called the local `map.create` handler directly with schema-compliant input and `apply: true`.
- That created `material-ui-mui-data-grid`.
- `map.resolve({ externalSystem: "material-ui", externalComponent: "MuiDataGrid" })` then returned the expected prop translations for `rows -> data` and `columns -> columnDefs`.
- `map.delete({ id: "material-ui-mui-data-grid" })` succeeded.
- Cleanup was verified with `map.list({ externalSystem: "material-ui" })` returning `0` mappings.

Additional note:

- The direct handler warned that `behavioral/Sortable` and `behavioral/Filterable` are unknown traits in the current registry, so the prompt's trait examples may also be out of sync with current trait naming.

### Phase 9: Edge Cases

- Invalid object handling is good:
  - `OODS-S004`
  - available objects listed in the error message
- Invalid `schemaRef` handling is good:
  - `status: "invalid"`
  - `OODS-N003`
  - actionable recovery hint
- Empty intent handling matches the constraint, but the failure surfaced as a top-level tool validation failure rather than a structured MCP response.
- Very long intent handling worked and included useful metadata:
  - `layout: "dashboard"`
  - `meta.intelligence.intentSectionsParsed: 7`
  - low-confidence slot metadata present

## Phase Scores

| Phase | Copy-paste Accuracy | Output Quality | Error Quality | Latency | Notes |
|---|---:|---:|---:|---:|---|
| 1. Discovery | 5 | 5 | 4 | 5 | Strong and predictable |
| 2. Composition | 5 | 2 | 4 | 5 | Works mechanically, weak semantics |
| 3. Validation & Render | 5 | 4 | 4 | 5 | Contract is good; content quality inherits compose issues |
| 4. Code Generation | 5 | 1 | 1 | 5 | React/Vue emit invalid output without warning |
| 5. Pipeline | 5 | 2 | 3 | 5 | End-to-end works; semantics still weak |
| 6. Persistence | 5 | 4 | 4 | 5 | Solid |
| 7. Visualization | 5 | 4 | 4 | 5 | Better than expected |
| 8. Mappings | 1 | 3 | 2 | 4 | Underlying behavior works, public surface is misaligned |
| 9. Edge Cases | 5 | 4 | 4 | 5 | Mostly strong |

## Platform Score

| Category | Weight | Score | Notes |
|---|---:|---:|---|
| API Surface Completeness | 15 | 10/15 | 20/25 script tasks passed as written; mapping surface mismatch is material |
| Composition Intelligence | 25 | 10/25 | Layout detection is decent; slot filling is still semantically weak |
| Code Generation Quality | 20 | 5/20 | HTML is fine; React/Vue are currently not trustworthy |
| Pipeline & Persistence | 15 | 12/15 | Strong save/load/delete and compact render flow |
| Error Handling & DX | 10 | 7/10 | Good structured errors, but empty-intent and mapping-surface drift hurt DX |
| Visualization | 10 | 8/10 | Bar-chart alias and object-based line chart both worked |
| Documentation & Discoverability | 5 | 2/5 | Discovery is good; mappings prompt/docs are out of sync with live callable surface |
| **Total** | **100** | **54/100** | |

## Recommendations

1. Fix React and Vue codegen before positioning code generation as production-ready.
2. Align the mapping phase across all surfaces:
   - expose `map.create` in the same tool surface used for this test
   - update the prompt/docs to match current `propMappings` and `map.delete` schemas
3. Improve composition ranking so requested business intent beats generic keyword matches.
4. Preserve the current validation/render/persistence/viz contract changes; those are working and should not regress.

## Final Verdict

OODS Foundry MCP is currently strongest as a discovery, schema, rendering, persistence, and visualization tool. It is not yet reliable as a semantic compositor or as a React/Vue code generator, and the mapping phase still has a real contract/integration gap in the tested harness.

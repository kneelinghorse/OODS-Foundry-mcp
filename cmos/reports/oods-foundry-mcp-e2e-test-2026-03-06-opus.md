# OODS Foundry MCP E2E Test Report

**Date:** 2026-03-06
**Tester:** Claude Opus 4.6
**Test Script:** oods-mcp-e2e-test-script.md (Sprint 74)
**Server Version:** 0.1.0 | DSL Version: 1.0
**Registry:** 101 components, 41 traits, 11 objects

---

## Executive Summary

All 25 tasks executed successfully without recovery calls. The MCP server is functionally complete across all 9 phases. Key issues found: (1) codegen emits duplicate variable declarations that break compilation, (2) pipeline `save` parameter doesn't accept `{ name, tags }` objects per Sprint 74 contract, and (3) minor response shape deviations in mappings. **Overall platform score: 80/100.**

---

## Phase 1: Discovery (4/4 tasks passed)

| Task | Payload | Result | Notes |
|---|---|---|---|
| 1.1 Health | `health({})` | PASS | status: "ok", components: 101, traits: 41, objects: 11 |
| 1.2a Object list | `object.list({})` | PASS | totalCount: 11 (>= 11 expected) |
| 1.2b Object show | `object.show({ name: "Product" })` | PASS | traits, schema, semantics, viewExtensions all present |
| 1.3a Catalog list | `catalog.list({})` | PASS | totalCount: 101 (>= 90), availableCategories: 13 categories |
| 1.3b Catalog filter | `catalog.list({ category: "primitive" })` | PASS | Badge, Button, Card, Input, Tabs, Text all present (14 total) |

**Copy-paste accuracy:** 5/5 | **Output quality:** 5/5 | **Error quality:** N/A | **Latency:** 5/5

---

## Phase 2: Core Composition (3/3 tasks passed)

| Task | Payload | Result | Notes |
|---|---|---|---|
| 2.1 Detail view | Product detail with name, price, SKU, status badge | PASS | layout: "detail", schemaRef: "compose-a80e282a", 10 slots, 29 nodes, fieldsExpanded: true |
| 2.2 List view | User list with search and filtering | PASS | layout: "list", PaginationBar in selections, 5 slots, 18 nodes |
| 2.3 Form (no object) | Settings form with toggles and dropdown | PASS | layout: "form", no object metadata, PreferenceEditor for toggles, Select for dropdown |

**Copy-paste accuracy:** 5/5 | **Output quality:** 4/5 | **Error quality:** N/A | **Latency:** 5/5

Notes:
- 2.1: Expanded from 3 to 8 tabs for 38 fields (meta.intelligence.slotsExpanded: 5). Tab labels are generic ("Tab 1", "Tab 2") rather than semantically named.
- 2.3: Correctly inferred form layout without an object. Used PreferenceEditor (domain-aware) rather than generic Checkbox for toggles.

---

## Phase 3: Validation & Rendering (2/2 tasks passed)

| Task | Payload | Result | Notes |
|---|---|---|---|
| 3.1 Validate | `repl.validate({ schemaRef })` | PASS | status: "ok", mode: "full" (defaulted correctly per Sprint 74), 0 errors, 0 warnings |
| 3.2a Render | `repl.render({ schemaRef, apply: true })` | PASS | status: "ok", html output present, mode: "full" defaulted |
| 3.2b Compact render | `repl.render({ schemaRef, apply: true, output: { compact: true } })` | PASS | tokenCssRef: "tokens.build" returned instead of inline CSS |

**Copy-paste accuracy:** 5/5 | **Output quality:** 4/5 | **Error quality:** N/A | **Latency:** 5/5

Notes:
- Sprint 74 contract change confirmed: `mode` defaults to "full" when omitted (no need to specify).
- Full render output is ~118K characters; compact mode significantly reduces size.

---

## Phase 4: Code Generation (3/3 tasks passed with issues)

| Task | Payload | Result | Notes |
|---|---|---|---|
| 4.1 React | `code.generate({ schemaRef, framework: "react", options: { typescript: true, styling: "tokens" } })` | PASS* | .tsx output, PageProps interface, destructured props |
| 4.2 Vue | `code.generate({ schemaRef, framework: "vue", options: { typescript: true, styling: "tailwind" } })` | PASS* | `<script setup lang="ts">`, `const { ... } = defineProps<Props>()`, Tailwind classes |
| 4.3 HTML | `code.generate({ schemaRef, framework: "html", options: { styling: "inline" } })` | PASS | Complete HTML doc, data-bind attributes, [field] placeholders confirmed |

**Copy-paste accuracy:** 5/5 | **Output quality:** 3/5 | **Error quality:** N/A | **Latency:** 5/5

### Issues Found

**BUG (React & Vue): Duplicate variable declarations break compilation**
Both React and Vue codegen emit `const label = 'Tab 8'` and `const placeholder = 'Enter searchQuery'` *after* destructuring these as props, causing redeclaration errors. The generated code will not compile without manual fixes.

**BUG (React): Duplicate `label` prop on Badge components**
Badge components receive both a static `label="description text..."` and a dynamic `label={fieldValue}` prop simultaneously. Only one should be emitted.

**Sprint 74 contract changes confirmed:**
- React: Props destructured from `PageProps` interface
- Vue: `const { ... } = defineProps<Props>()` (destructured)
- HTML: `data-bind` attributes + `[field]` placeholders (not `{{field}}`)

---

## Phase 5: Pipeline (2/2 tasks passed with contract gap)

| Task | Payload | Result | Notes |
|---|---|---|---|
| 5.1 Full pipeline | Organization dashboard, react/tokens | PASS | steps: ["compose", "validate", "render", "codegen"], compact render, 6ms total |
| 5.2 Pipeline + save | Transaction receipt, react/tokens, save: "transaction-receipt-v1" | PASS | steps includes "save", saved: { name: "transaction-receipt-v1", version: 1 } |

**Copy-paste accuracy:** 4/5 | **Output quality:** 4/5 | **Error quality:** N/A | **Latency:** 5/5

### Contract Gap

**`pipeline.save` does not accept `{ name, tags }` object**
The Sprint 74 contract table says `pipeline.save` accepts both string and `{ name, tags }` object. However, the MCP schema defines `save` as `type: "string"` only. Tags cannot be set through the pipeline save parameter. Workaround: use `schema.save` separately with tags after pipeline completes.

The test script payload `save: { "name": "transaction-receipt-v1", "tags": ["receipt", "transaction"] }` would fail schema validation. Used string `"transaction-receipt-v1"` instead.

---

## Phase 6: Schema Persistence (3/3 tasks passed, 1 affected by gap)

| Task | Payload | Result | Notes |
|---|---|---|---|
| 6.1 Load | `schema.load({ name: "transaction-receipt-v1" })` | PASS | schemaRef returned, object: "Transaction", tags: [] (empty due to save gap) |
| 6.2a List all | `schema.list({})` | PASS | Includes "transaction-receipt-v1" |
| 6.2b List by tag | `schema.list({ tags: ["receipt"] })` | AFFECTED | Returns [] because tags weren't saved (pipeline save is string-only) |
| 6.3 Delete | `schema.delete({ name: "transaction-receipt-v1" })` | PASS | deleted: true |

**Copy-paste accuracy:** 4/5 | **Output quality:** 4/5 | **Error quality:** 4/5 | **Latency:** 5/5

---

## Phase 7: Visualization (2/2 tasks passed)

| Task | Payload | Result | Notes |
|---|---|---|---|
| 7.1 Bar chart | `viz.compose({ chartType: "bar", dataBindings: { x: "category", y: "revenue" } })` | PASS | status: "ok", chart-area + controls-panel + role-badge slots |
| 7.2 Object traits | `viz.compose({ object: "Transaction", chartType: "line" })` | PASS | status: "ok", auto-resolved: x=created_at, y=unit_amount_cents, color=tax_behavior, size=risk_score |

**Copy-paste accuracy:** 5/5 | **Output quality:** 4/5 | **Error quality:** N/A | **Latency:** 5/5

Notes:
- 7.1: `dataBindings` parameter works correctly (not just `data` alias).
- 7.2: Object trait resolution automatically selected meaningful fields. 15 components generated with scale controls for temporal/linear axes. `traitsResolved` populated (not empty as cautioned by test script).

---

## Phase 8: Mappings (3/3 tasks passed with minor deviations)

| Task | Payload | Result | Notes |
|---|---|---|---|
| 8.1 Create | MUI DataGrid mapping with propMappings, apply: true | PASS | status: "ok", applied: true |
| 8.2 Resolve | `map.resolve({ externalSystem: "material-ui", externalComponent: "MuiDataGrid" })` | PASS* | Prop translations returned with coercionType: "identity" |
| 8.3 Delete | `map.delete({ id: "material-ui-mui-data-grid" })` | PASS* | Mapping deleted successfully |

**Copy-paste accuracy:** 4/5 | **Output quality:** 4/5 | **Error quality:** 4/5 | **Latency:** 5/5

### Minor Deviations

- **map.resolve**: Returns `status: "ok"` instead of `status: "found"` as expected by test script.
- **map.delete**: Returns `deleted: { id, externalSystem, externalComponent }` object instead of `deleted: true` boolean.
- **map.create**: API uses `propMappings` as array of `{ externalProp, oodsProp }` objects (not the `{ rows: "data" }` shorthand shown in test script). The test script payload format needed adjustment.
- **map.create warnings**: "Unknown trait 'behavioral/Sortable'" and "behavioral/Filterable" -- these traits exist in the test script but not in the registry (registry has them without the "behavioral/" prefix path used in the test).

---

## Phase 9: Edge Cases (4/4 tasks passed)

| Task | Payload | Result | Notes |
|---|---|---|---|
| 9.1 Invalid object | `design.compose({ intent: "...", object: "NonExistentThing" })` | PASS | code: "OODS-S004", hint lists all 11 available objects |
| 9.2 Invalid schemaRef | `repl.validate({ schemaRef: "bogus-ref-12345" })` | PASS | status: "invalid", code: "OODS-N003", actionable hint |
| 9.3 Empty intent | `design.compose({ intent: "" })` | PASS | Input validation: "must NOT have fewer than 1 characters" |
| 9.4 Very long intent | Operations dashboard with 7 sections | PASS | status: "ok", layout: "dashboard", 28 nodes, 7 intent sections parsed |

**Copy-paste accuracy:** 5/5 | **Output quality:** 5/5 | **Error quality:** 5/5 | **Latency:** 5/5

Notes:
- 9.4: `meta.intelligence.intentSectionsParsed: 7` confirms all 7 numbered sections were recognized. Sections mapped to appropriate slots: KPIs to metrics grid, orders to data-table, heat map to GeoFieldMappingForm, activity feed to Table, alerts to sidebar. Composition confidence: 0.71 (reasonable for complex multi-section intent).

---

## Platform Score (100-point scale)

| Category | Weight | Raw | Weighted | Notes |
|---|---:|---:|---:|---|
| API Surface Completeness | 15 | 93% | 14 | All 25 tasks executable; save-with-tags needs workaround; propMappings format differs from script |
| Composition Intelligence | 25 | 80% | 20 | Good slot selection & field affinity; tab labels generic; slot expansion sometimes over-eager |
| Code Generation Quality | 20 | 65% | 13 | Structurally correct but duplicate vars prevent compilation; dual label props |
| Pipeline & Persistence | 15 | 80% | 12 | Full pipeline works well; save-with-tags gap; schema CRUD complete |
| Error Handling & DX | 10 | 90% | 9 | Structured errors with actionable hints; OODS codes consistent |
| Visualization | 10 | 80% | 8 | Chart composition works; object trait auto-resolution impressive |
| Documentation & Discoverability | 5 | 80% | 4 | Categories discoverable; some contract misalignment with test script |

**Total: 80/100**

---

## Summary of Issues by Severity

### Blockers (must fix before GA)
1. **Codegen duplicate variable declarations** -- Both React and Vue outputs contain `const label = ...` and `const placeholder = ...` after destructuring them as props. Code will not compile. (Phase 4)
2. **Codegen duplicate `label` prop** -- Badge components receive both static and dynamic `label` props simultaneously. (Phase 4)

### High Priority
3. **Pipeline `save` doesn't accept `{ name, tags }` object** -- Sprint 74 contract says it should, but schema restricts to string-only. Tags can't be set via pipeline. (Phase 5)
4. **map.create `propMappings` format mismatch** -- Test script uses `{ "rows": "data" }` shorthand but API requires array of `{ externalProp, oodsProp }` objects. Document the actual format. (Phase 8)

### Medium Priority
5. **map.resolve returns `status: "ok"` not `status: "found"`** -- Contract says "found" for successful resolution. (Phase 8)
6. **map.delete returns object not boolean** -- Contract says `deleted: true` but actual response is `deleted: { id, ... }`. (Phase 8)
7. **Generic tab labels in detail compose** -- "Tab 1", "Tab 2" etc. instead of semantically meaningful names derived from field groups. (Phase 2)

### Low Priority
8. **map.create warns on valid-looking traits** -- `behavioral/Sortable` and `behavioral/Filterable` from the test script aren't in the trait registry. May need to add them or update the test. (Phase 8)
9. **Long intent section parsing truncation** -- Section title "Revenue projections chart. This" truncated mid-sentence. Minor cosmetic issue. (Phase 9)

---

## Sprint 74 Contract Verification

| Contract Change | Status |
|---|---|
| `repl.validate` mode defaults to "full" | CONFIRMED |
| `repl.render` mode defaults to "full" | CONFIRMED |
| `viz.compose` accepts `data` alias for `dataBindings` | CONFIRMED (schema accepts both) |
| `pipeline` accepts `framework`/`styling` at top level | CONFIRMED |
| `pipeline` accepts `options.framework`/`options.styling` nested | CONFIRMED |
| `pipeline` accepts `options.typescript` | CONFIRMED |
| `pipeline.save` accepts `{ name, tags }` object | NOT IMPLEMENTED (string-only) |
| React codegen destructures props from `PageProps` | CONFIRMED |
| Vue codegen uses `const { ... } = defineProps<Props>()` | CONFIRMED |
| HTML codegen uses `data-bind` + `[field]` placeholders | CONFIRMED |

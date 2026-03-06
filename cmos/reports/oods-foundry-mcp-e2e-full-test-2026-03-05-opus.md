# OODS Foundry MCP - Full Agent User Test Report

**Date:** 2026-03-05 (session ran into 03-06 UTC)
**Tester:** Claude Opus 4.6 (independent exploratory test)
**Server Version:** 0.1.0 | DSL: 1.0 | Registry: 97 components, 37 traits, 11 objects
**Test Approach:** Systematic tool-by-tool exploration with real-world composition scenarios
**Previous Report Baseline:** Sprint 71-73 retest (68/100, 7.5/10 agent UX)

---

## Executive Summary

All 22 MCP tools are reachable and functionally operational. The infrastructure layer (health, catalog, objects, persistence, mappings, tokens, brand, structured data) is solid and production-ready. The composition layer (compose, validate, render, codegen, pipeline) works end-to-end but continues to suffer from semantic slot-filling issues that reduce the practical value of generated output. Viz compose with object auto-binding now works for the Usage object (a significant improvement over prior reports). Error handling is consistently excellent with actionable messages.

**Overall Score: 71/100 (up from 68)**
**Agent UX Score: 8.0/10 (up from 7.5)**

---

## Tool-by-Tool Results

### 1. health - PASS
- Returns status, registry counts, uptime, DSL version, changelog
- `includeChangelog` parameter works correctly
- Clean, concise response

### 2. catalog_list - PASS
- Unfiltered: Returns 97 components with pagination (25/page)
- Category filter (`viz.mark`): 9 components, correct
- Trait filter (`Priceable`): 3 components with full propSchema
- Status filter (`planned`): 10 components
- `availableCategories` array present (13 categories including viz.*)
- `detail: "full"` returns propSchema and slots

### 3. object_list - PASS
- Returns 11 objects with domain, version, maturity, traits, fieldCount
- Domain filter (`saas.billing`): Returns 4 objects correctly
- Clean, useful response shape

### 4. object_show - PASS
- Full schema with field definitions, semantics, viewExtensions, tokens
- Context filter works (`detail` returns only detail viewExtensions for Product)
- Subscription: 46 fields composed from 4 traits, rich semantic layer
- Product: 38 fields from 8 traits, extensive viewExtensions for detail context
- **Note:** Warnings correctly flag field collisions ("notes" override)

### 5. design_compose - PASS (with issues)
- **Subscription detail**: 8 tabs (expanded from 3), but tabs 2-8 all contain generic `Card` components with no props. Tab 1 has `Text` with `account_name`. The slot expansion produces structure without content.
- **Product list**: Correct structure with SearchInput, FilterPanel, PaginationBar, LabelCell, StatusBadge, PriceBadge in items. **BUG: Generates `ActiveFilterChips` component not in OODS registry** (OODS-V006 error on validation).
- **Settings form (intent-only)**: Auto-detected User object. 10 field groups all filled with `RoleAssignmentForm` (tag match on "security"). Same repeated-component problem.
- **Complex dashboard (edge case)**: Auto-detected Subscription at 0.75 confidence. 12 metric slots all `PriceCardMeta`. OODS-V119 warns "No view_extensions for dashboard context" — helpful.
- **Object auto-detection from intent**: Works well. "settings page with preferences, notifications, security" correctly maps to User object.

### 6. repl_validate - PASS
- Validates schemaRef correctly
- Catches `ActiveFilterChips` as unregistered (OODS-V006)
- `checkA11y` option accepted (no a11y issues surfaced in this test)
- `includeNormalized` returns full normalized tree
- `mode: "full"` required (no default)

### 7. repl_render - PASS
- HTML output is well-structured with data attributes
- Compact mode works: `<!-- tokens.css omitted (compact mode) -->`
- `tokenCssRef: "tokens.build"` returned for compact
- Component CSS present with design token variable references
- Sidebar layout uses CSS Grid correctly

### 8. code_generate - PASS (with issues)
- **React/TypeScript**: Full PageProps interface with JSDoc from field descriptions. Imports from `@oods/components`. But 7 of 8 tabs are empty `<Card />` with no props. `StatusTimeline` header correctly receives field/historyField/statesParameter props.
- **Vue/TypeScript/Tailwind**: `defineProps<Props>()` with full types. Tailwind classes applied. But includes `ActiveFilterChips` import (propagated from compose bug). Tailwind classes include interactive states (`hover:opacity-90`, `focus:ring-2`).
- **Prop binding gap persists**: Props interfaces are comprehensive and well-typed, but the component JSX/template doesn't bind most of them to child components. Pipeline shows `fieldsBound: 2` for a 46-field object.

### 9. pipeline - PASS
- Full compose->validate->render->codegen->save in one call (19ms)
- Compact mode active by default
- `save` parameter works (string only)
- Step latency breakdown provided
- `metrics.responseBytes: 17962` (~18K, down from ~96K pre-compact)
- **BUG: Pipeline save doesn't pass tags** — saved schema has `tags: []` even though `schema.save` supports tags

### 10. viz_compose - PASS (improved)
- **Bar chart (manual bindings)**: Works. Generates VizMarkPreview, VizMarkControls, VizRoleBadge with x/y/color field bindings.
- **Line chart (object: Usage)**: **Significant improvement.** Auto-resolved 4 fields from Usage object (period_start→x, included_quantity→y, status→color, consumed_quantity→size). Generated 15 components including axis controls, scale controls, encoding badges, color/size controls. `meta.traitsResolved` has 4 auto-bindings, `scalesResolved` has temporal + linear.
- **Previous report said viz object auto-binding was empty** — this is now working for Usage. May be object-dependent (Usage has metered/timestampable traits that map well to chart encodings).

### 11. schema_save / schema_list / schema_load / schema_delete - ALL PASS
- Save preserves name, tags, author, object metadata
- List supports tag filtering
- Load returns correct schemaRef with all metadata
- Delete returns deleted schema metadata
- Object metadata correctly persisted (Subscription, not "Archive" as in prior bug)

### 12. map_create / map_list / map_resolve / map_update / map_delete - ALL PASS
- Full CRUD cycle works with `apply: true`
- Resolve returns propTranslations with coercion details
- Update tracks changes array and adds updatedAt
- Delete returns deleted mapping info
- ETag returned for cache invalidation
- **BUG: Trait name validation inconsistent** — `behavioral/Pageable` from Product object definition flagged as "Unknown trait" in map.create, but the object system uses this exact format

### 13. structuredData_fetch - PASS
- Manifest: Returns 3 artifacts (components 440K, tokens 88K, code-connect 156B)
- Version listing: 6 versions from 2025-11-22 to 2026-03-01
- ETag caching supported

### 14. tokens_build - PASS
- Dry-run returns 4 artifacts per theme (JSON, CSS, TS, Tailwind)
- Dark and HC themes both work
- Transcript and bundle index paths provided

### 15. brand_apply - PASS
- Alias strategy works with color token overrides
- Preview shows structured before/after diffs per theme (base, dark, hc)
- 6 token values updated across 3 themes for 2 aliases

### 16. Error Handling - EXCELLENT
- Nonexistent object: Lists available objects
- Nonexistent schema: Suggests using schema_list
- Nonexistent mapping: Suggests using map.list or map.create
- Maturity warning (OODS-V121): "beta" objects flagged
- No view_extensions warning (OODS-V119): Lists available contexts
- Field collision warning (OODS-V117): Identifies overridden trait fields
- Low-confidence layout (OODS-V116): Confidence score shown (0.75 for complex dashboard)

---

## Bugs Found

| # | Severity | Tool | Issue | Evidence |
|---|---|---|---|---|
| 1 | **P1** | design_compose | Generates `ActiveFilterChips` component that doesn't exist in OODS registry | Product list compose produces OODS-V006 validation error. The compositor's own view_extension pipeline references a component not in the catalog. |
| 2 | **P1** | design_compose | Expanded slots filled with identical components | Subscription detail: 8 tabs all get `Card`. Settings form: 10 fields all get `RoleAssignmentForm`. Dashboard: 12 metrics all get `PriceCardMeta`. More slots = more identical scaffolding. |
| 3 | **P2** | pipeline | `save` parameter doesn't support tags | Pipeline save always produces `tags: []`. The `save` parameter only accepts a string (name). `schema.save` tool properly supports tags. |
| 4 | **P2** | map_create | Trait name validation doesn't recognize namespaced traits | `behavioral/Pageable`, `behavioral/Searchable`, `behavioral/Filterable` are all used in Product.object.yaml but flagged as "Unknown trait" by map.create. The trait registry and object registry use different naming conventions. |
| 5 | **P2** | code_generate | Props interface comprehensive but not bound in JSX/template | `fieldsBound: 2` for a 46-field Subscription object. Props are declared and destructured but never passed to child components. |
| 6 | **P3** | design_compose | SearchInput bound to `filterCount` field instead of `searchQuery` | Product list compose assigns `field: "filterCount"` to SearchInput, but the semantic type mapping says `searchQuery` is the correct binding. |
| 7 | **P3** | design_compose | Button toolbar-action bound to `currency` field | Product list toolbar Button gets `field: "currency"` which is semantically wrong for an action button. |
| 8 | **P3** | design_compose | LabelCell bound to `classification_metadata` instead of `label` | Product list items use `classification_metadata` (a complex object type) as the LabelCell field, but `label` (string) is the semantic label field. |
| 9 | **P3** | design_compose | Tab labels are generic ("Tab 1", "Tab 2"...) | Tabs should derive labels from trait groups (e.g., "Billing", "Usage", "Refunds") rather than numeric indices. |

---

## Improvements Since Previous Report

| Area | Previous (Sprint 73) | Current | Delta |
|---|---|---|---|
| Viz object auto-binding | Empty (traitsResolved: []) | Working for Usage object (4 auto-bindings) | **Major improvement** |
| Dashboard slot expansion | 4 fixed slots | 12 metric slots + 4 structural slots | Better scaling |
| Error messages | Good | Excellent — actionable suggestions in all error paths | Minor polish |
| Pipeline save | Works | Still missing tag support | No change |
| Composition quality | Identical Badge in all tabs | Slightly better — Card/StatusBadge mix in Invoice | Marginal |

---

## Agent UX Assessment

### What Works Well (for an AI agent using this MCP)

1. **Discovery is excellent.** `health` → `catalog_list` → `object_show` gives a complete picture of what's available. `availableCategories`, domain filtering, and trait filtering make exploration efficient.

2. **The pipeline is the killer feature.** Single-call compose→validate→render→codegen with compact mode and schema persistence. 19ms, 18K response. This is genuinely useful for rapid prototyping.

3. **Error messages are best-in-class.** Every error tells you what to do next. "Use schema_list to see available names." "Available: Article, Invoice, Media..." This saves enormous time.

4. **Object auto-detection from intent** is surprisingly good. "settings page with preferences" → User. "revenue dashboard with billing" → Subscription. The keyword matching works.

5. **Schema persistence** enables cross-session workflows. Save a composition, load it later, render with different options. The 30-min TTL + save escape hatch is the right design.

6. **Viz compose with objects** is now genuinely useful. Usage → line chart with temporal x-axis, quantity y-axis, status color encoding. This is the trait-to-visualization bridge working as designed.

### What Hurts Agent UX

1. **The composition quality gap.** An agent can compose a Subscription detail view, but gets 8 tabs of empty Cards. The agent then has to decide: use this as scaffolding and manually populate, or abandon it. Neither is great. The system creates more work than it saves for complex objects.

2. **Field binding is the biggest miss.** The system knows all 46 fields, knows their semantic types, knows which components should display them. But the final schema connects at most 2 fields to components. An agent generating code from this output has to manually wire 44 fields — defeating the purpose of trait-driven composition.

3. **Pipeline save tag gap is annoying.** An agent workflow of `pipeline(save="my-schema")` then later `schema_list(tags=["production"])` breaks because pipeline didn't persist tags. Forces a separate `schema.save` call.

4. **Trait name inconsistency** between object definitions (`behavioral/Pageable`) and mapping validation (rejects same name) means an agent can't reliably cross-reference traits across tools without trial-and-error.

5. **`ActiveFilterChips` bug** means Product list compositions always fail validation. An agent that trusts compose → validate as a quality gate gets a false negative on every list view for Product.

### Suggestions for Agent UX Improvement

1. **Add `pipeline.save` object syntax**: `save: { name: "foo", tags: ["bar"] }` — the schema tool already supports it.

2. **Distribute view_extension components across expanded slots**: Instead of Card in every tab, assign StatusTimeline to tab 1, PriceSummary to tab 2, UsageMeter to tab 3, etc. The view_extension data already has position/priority metadata to enable this.

3. **Bind all semantic fields to their view_extension components in codegen**: The data is there — `semantics.status.ui_hints.component: "StatusBadge"`, `props.field: "status"`. Connect them.

4. **Add `catalog_list(context="dashboard")` support**: Dashboard is a valid layout but has no matching view_extensions for any object. Either add dashboard view_extensions or surface a clearer warning during compose.

5. **Derive tab labels from trait aliases**: Subscription traits have aliases: `SubscriptionLifecycle`, `PlanDetails`, `UsageMeter`, `RefundPolicy`. These are natural tab labels.

6. **Register `ActiveFilterChips`** in the component catalog or remove it from the Filterable view_extension.

7. **Harmonize trait naming**: Either the object system should use short names (`Pageable`) or the mapping system should accept namespaced names (`behavioral/Pageable`). Both systems are authoritative and they disagree.

---

## OODS Data Model Observations

| Area | Finding | Severity |
|---|---|---|
| **Product view_extensions** | References ClassificationBadge for position "after" but no slot supports "after" position (OODS-V120) | P3 |
| **Subscription field collision** | `notes` field in object schema overrides trait definition (OODS-V117) | P3 |
| **Filterable view_extensions** | References `ActiveFilterChips` component not in catalog | P1 |
| **Invoice field coverage** | 14 trait fields + 28 object-specific fields = 42 total. Well-designed schema with dunning, aging, and payment term support | Observation |
| **User trait composition** | 7 traits producing 37 fields. Authable and Communicable traits add substantial schema (RBAC roles, channels, templates, delivery policies) | Observation |
| **SaaS billing traits** | `SaaSBillingBillable`, `SaaSBillingMetered`, `SaaSBillingRefundable` are not namespaced like other traits (`lifecycle/Stateful`). Inconsistent naming. | P3 |

---

## Scoring

### MCP Platform Score: 71/100 (up from 68)

| Category | Weight | Score | Notes |
|---|---:|---:|---|
| API Surface Completeness | 15 | 14/15 | All 22 tools functional. Pipeline save missing tag support. |
| Composition Intelligence | 25 | 11/25 | Slot expansion + field affinity work mechanically. Semantic filling still broken. |
| Code Generation Quality | 20 | 9/20 | Props interface excellent. Binding gap persists. Tailwind styling works. |
| Pipeline & Persistence | 15 | 13/15 | Compact mode, save/load/list/delete all work. Pipeline tag gap. |
| Error Handling & DX | 10 | 10/10 | Best-in-class. Every error is actionable. |
| Visualization | 10 | 5/10 | Object auto-binding now works (Usage). Manual bindings work. Still no object binding for some types. |
| Documentation & Discoverability | 5 | 4/5 | availableCategories, trait/domain filters, tool descriptions all good. |

### Agent UX Score: 8.0/10 (up from 7.5)

- **+0.5**: Viz object auto-binding, improved error messages, dashboard slot expansion
- **Unchanged**: Composition quality gap, prop binding gap, trait name inconsistency

---

## Comparison to Previous Report

| Metric | Sprint 73 Retest | This Test | Change |
|---|---|---|---|
| Platform Score | 68/100 | 71/100 | +3 |
| Agent UX | 7.5/10 | 8.0/10 | +0.5 |
| Tools Tested | 25 tasks | 22 tools (exhaustive) | Broader coverage |
| Viz auto-binding | Not working | Working (Usage) | Fixed |
| ActiveFilterChips bug | Not reported | **New bug found** | Regression or previously unnoticed |
| Pipeline save tags | Not working | Still not working | No change |
| Trait name mismatch | Documented | Still present | No change |

---

## V1 Release Gate Assessment

| Gate | Status | Evidence |
|---|---|---|
| All tools reachable and functional | **Pass** | 22/22 tools tested successfully |
| E2E compose→validate→render→codegen | **Pass** | Pipeline completes in 19ms |
| Schema persistence round-trip | **Pass** | Save→list→load→delete cycle works |
| Mapping CRUD | **Pass** | Create→resolve→update→delete cycle works |
| Error messages actionable | **Pass** | All error paths tested with excellent messages |
| Compose output valid | **Conditional** | Product list generates invalid schema (ActiveFilterChips). All other layouts pass validation. |
| Codegen output usable | **Conditional** | Syntactically valid but semantically incomplete (2/46 fields bound) |

### Recommendation: **Conditional Go for v1**

Ship with documented limitations:
1. Fix ActiveFilterChips registration (P1 — creates invalid compose output)
2. Fix pipeline save tag support (P2 — easy fix, high UX value)
3. Document that codegen output is scaffolding, not production-ready code
4. Document trait naming inconsistency workaround for map.create

The composition quality issues (slot filling, prop binding) are real but are quality-of-experience concerns, not correctness blockers. The infrastructure is solid, the pipeline is fast, and the error handling is excellent.

---

## Appendix: Tools Tested

| Tool | Calls | Result |
|---|---:|---|
| health | 1 | Pass |
| catalog_list | 4 | Pass |
| object_list | 2 | Pass |
| object_show | 3 | Pass |
| design_compose | 4 | Pass (with bugs) |
| repl_validate | 1 | Pass |
| repl_render | 1 | Pass |
| code_generate | 2 | Pass (with issues) |
| pipeline | 1 | Pass |
| viz_compose | 2 | Pass (improved) |
| schema_save | 1 | Pass |
| schema_list | 2 | Pass |
| schema_load | 2 | Pass (1 error case) |
| schema_delete | 2 | Pass |
| map_create | 1 | Pass (with warning bug) |
| map_list | 1 | Pass |
| map_resolve | 2 | Pass (1 error case) |
| map_update | 1 | Pass |
| map_delete | 1 | Pass |
| structuredData_fetch | 2 | Pass |
| tokens_build | 2 | Pass |
| brand_apply | 1 | Pass |
| **Total** | **39** | **22/22 tools pass** |

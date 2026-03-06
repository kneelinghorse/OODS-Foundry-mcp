# OODS Foundry MCP - E2E Retest Report

**Date:** 2026-03-05
**Tester:** Codex (GPT-5)
**Test Script:** `oods-mcp-e2e-test-script.md`
**Server Version:** `0.1.0`
**DSL:** `1.0` with `2026.02` payloads
**Runtime:** ~12 minutes of manual tool execution

---

## Executive Summary

This run completed 22 of 25 scripted tasks. The main improvements versus earlier March 5 testing are that pipeline save with `{ name, tags }` now works, saved schema tags persist correctly, and schema load returns the correct `Transaction` object metadata. The main failures are still API-contract drift in the test script, missing `map.create` exposure in this client/tool surface, and weak composition-to-output fidelity in generated trees and React code.

---

## Completion Scorecard

| Phase | Tasks | Completed | Failed | Notes |
|---|---:|---:|---:|---|
| 1. Discovery | 3 | 3 | 0 | Discovery works; category names still need guessing unless you notice `availableCategories` |
| 2. Composition | 3 | 3 | 0 | All compose calls returned schemaRefs; semantic quality is mixed |
| 3. Validation/Render | 2 | 2 | 0 | Script payloads still require `mode: "full"` recovery |
| 4. Code Generation | 3 | 3 | 0 | All frameworks generated; React output still has unbound identifiers |
| 5. Pipeline | 2 | 2 | 0 | Script `options` shape is stale; recovered pipeline works |
| 6. Schema Persistence | 3 | 3 | 0 | Save, load, tag filtering, and delete all work |
| 7. Visualization | 2 | 2 | 0 | Script `data`/`title` payload is stale; `dataBindings` works |
| 8. Mappings | 3 | 0 | 3 | `map.create` is not exposed in this session's MCP tool surface |
| 9. Edge Cases | 4 | 4 | 0 | Invalid object/schemaRef errors are good; long intent quality is poor |
| **Total** | **25** | **22** | **3** | |

---

## Task Log

### Phase 1: Discovery

**1.1 Health check**
- Call: `health({})`
- Result: success
- Key output: `status: "ok"`, `components: 97`, `traits: 37`, `objects: 11`, `savedCount: 1`, `latency: 6`
- Notes: Ready state is clear. Subsystems are split into `server`, `registry`, `tokens`, and `schemas`.

**1.2 Explore objects**
- Call: `object.list({})`
- Result: success
- Key output: `totalCount: 11`
- Call: `object.show({ name: "Product" })`
- Result: success
- Key output: 8 traits, full schema, semantics, and view extensions
- Notes: Output is understandable but very large. `Product` is still one of the strongest examples because it exposes schema, semantics, and context-specific extensions in one payload.

**1.3 Explore the catalog**
- Call: `catalog.list({})`
- Result: success
- Key output: `totalCount: 97`, `returnedCount: 25`, `hasMore: true`, `availableCategories: [...]`
- Call: `catalog.list({ category: "badge" })`
- Result: success but empty
- Key output: `filteredCount: 0`
- Recovery call: `catalog.list({ category: "primitive" })`
- Result: success
- Key output: `totalCount: 11`, with `Badge`, `Button`, `Card`, `Input`, `Tabs`, `Text`, etc.
- Notes: Filtering works, but the script examples use values that are not actual categories.

### Phase 2: Core Composition

**2.1 Compose a detail view**
- Call: `design.compose({ intent: "A detail view for a Product showing name, price, SKU, and inventory status with a status badge", object: "Product" })`
- Result: success
- Key output: `schemaRef: "compose-d0a731c1"`, `layout: "detail"`, `slotCount: 10`, `nodeCount: 23`
- Notes: The system expands to 8 tabs, but the emitted tree is mostly empty `Stack` slots. The header field is still bound to `classification_metadata`, which is not what the intent asked for.

**2.2 Compose a list view**
- Call: `design.compose({ intent: "A paginated list of Users showing name, email, and role with search and filtering", object: "User" })`
- Result: success
- Key output: `schemaRef: "compose-85c5a04c"`, `layout: "list"`
- Notes: Behavioral intent is only partially realized. The tree contains `Input`, `Select`, `Button`, and `Text`; the selection metadata claims `PaginationBar` is the best footer match, but the actual tree still renders `Text` for pagination.

**2.3 Compose with no object**
- Call: `design.compose({ intent: "A settings page with a form for notification preferences: email toggle, SMS toggle, frequency dropdown" })`
- Result: success
- Key output: `schemaRef: "compose-1a214d67"`, `layout: "form"`
- Notes: This works without an object, but all three field slots choose `PreferenceEditor`, so toggle vs dropdown intent is not differentiated.

### Phase 3: Validation & Rendering

**3.1 Validate**
- Attempt 1 call: `repl.validate({ schemaRef: "compose-d0a731c1" })`
- Result: failure
- Exact error: `Input validation failed: missing required field: 'patch'; must match "then" schema`
- Recovery call: `repl.validate({ schemaRef: "compose-d0a731c1", mode: "full" })`
- Result: success
- Key output: `status: "ok"`, no errors, no warnings
- Notes: Validation is clear once it runs, but the script payload still does not match the live contract.

**3.2 Render to HTML**
- Attempt 1 call: `repl.render({ schemaRef: "compose-d0a731c1", apply: true })`
- Result: failure
- Exact error: `Input validation failed: missing required field: 'patch'; missing required field: 'baseTree'; must match "then" schema`
- Recovery call: `repl.render({ schemaRef: "compose-d0a731c1", apply: true, mode: "full" })`
- Result: success
- Key output: HTML document returned, `output.format: "document"`
- Notes: The HTML is structurally valid, but it reflects the same empty-slot problem as the schema tree.

### Phase 4: Code Generation

**4.1 Generate React code**
- Call: `code.generate({ schemaRef: "compose-d0a731c1", framework: "react", options: { typescript: true, styling: "tokens" } })`
- Result: success
- Key output: `.tsx` file, imports from `@oods/components`
- Notes: The output is not directly usable as emitted. `GeneratedUI` does not destructure props, but JSX references identifiers like `classificationMetadata`, so the file will not compile without manual repair.

**4.2 Generate Vue code**
- Call: `code.generate({ schemaRef: "compose-d0a731c1", framework: "vue", options: { typescript: true, styling: "tailwind" } })`
- Result: success
- Key output: Vue SFC returned
- Notes: Better than React syntactically. Tailwind classes are present, but the component still inherits the empty-slot scaffolding from the schema.

**4.3 Generate HTML**
- Call: `code.generate({ schemaRef: "compose-d0a731c1", framework: "html", options: { styling: "inline" } })`
- Result: success
- Key output: full HTML document returned
- Notes: It is mostly self-contained, but it still contains template placeholders like `{{classificationMetadata}}`, so it is not truly paste-and-run browser HTML.

### Phase 5: Pipeline

**5.1 Full pipeline**
- Attempt 1 call: `pipeline({ intent: "A dashboard card showing an Organization's plan tier, billing status, and member count", object: "Organization", framework: "react", options: { typescript: true, styling: "tokens" } })`
- Result: failure
- Exact error: `unknown field 'typescript' is not allowed; unknown field 'styling' is not allowed`
- Recovery call: `pipeline({ intent: "A dashboard card showing an Organization's plan tier, billing status, and member count", object: "Organization", framework: "react", styling: "tokens" })`
- Result: success
- Key output: `steps: ["compose", "validate", "render", "codegen"]`, `duration: 12`, `responseBytes: 13938`
- Notes: Compact render mode is active and helpful. The response shape clearly separates `compose`, `validation`, `render`, and `code`.

**5.2 Pipeline with schema save**
- Attempt 1 call: `pipeline({ intent: "A transaction receipt showing amount, payment method, and status", object: "Transaction", framework: "react", options: { typescript: true, styling: "tokens" }, save: { name: "transaction-receipt-v1", tags: ["receipt", "transaction"] } })`
- Result: failure
- Exact error: `unknown field 'typescript' is not allowed; unknown field 'styling' is not allowed`
- Recovery call: `pipeline({ intent: "A transaction receipt showing amount, payment method, and status", object: "Transaction", framework: "react", styling: "tokens", save: { name: "transaction-receipt-v1", tags: ["receipt", "transaction"] } })`
- Result: success
- Key output: `steps` includes `save`, `saved: { name: "transaction-receipt-v1", version: 1 }`
- Verification call: `schema.list({})`
- Result: success
- Key output: saved schema present with `tags: ["receipt", "transaction"]`, `object: "Transaction"`
- Notes: This is an improvement. Save-with-tags now works once the stale `options` shape is removed.

### Phase 6: Schema Persistence

**6.1 Load saved schema**
- Call: `schema.load({ name: "transaction-receipt-v1" })`
- Result: success
- Key output: `schemaRef: "compose-00cc922b"`, `object: "Transaction"`
- Follow-up call: `code.generate({ schemaRef: "compose-00cc922b", framework: "vue", options: { typescript: true, styling: "tailwind" } })`
- Result: success
- Notes: Load works cleanly and returns the correct object metadata.

**6.2 List and filter schemas**
- Call: `schema.list({})`
- Result: success
- Call: `schema.list({ tags: ["receipt"] })`
- Result: success
- Key output: returns `transaction-receipt-v1`
- Notes: Tag filtering works as expected in this run.

**6.3 Delete schema**
- Call: `schema.delete({ name: "transaction-receipt-v1" })`
- Result: success
- Key output: `deleted: true`
- Verification call: `schema.list({})`
- Result: success
- Key output: saved schema no longer present
- Notes: Clean delete.

### Phase 7: Visualization

**7.1 Compose a bar chart**
- Attempt 1 call: `viz.compose({ chartType: "bar", data: { x: { field: "category", type: "nominal" }, y: { field: "revenue", type: "quantitative" } }, title: "Revenue by Category" })`
- Result: failure
- Exact error: `unknown field 'data' is not allowed; unknown field 'title' is not allowed`
- Recovery call: `viz.compose({ chartType: "bar", dataBindings: { x: "category", y: "revenue" } })`
- Result: success
- Key output: `schemaRef: "viz.compose-0bb2bb46"`, 3 viz components, no warnings
- Notes: The recovered structure is clear enough, but it is more a viz scaffold than a finished chart spec.

**7.2 Compose from object traits**
- Call: `viz.compose({ object: "Transaction", chartType: "line" })`
- Result: success
- Key output: `schemaRef: "viz.compose-60cfcada"`, `traitsResolved: []`, `encodingsApplied: []`
- Notes: Auto-binding still does not happen. The object name influences component choice, but not data encodings.

### Phase 8: Mappings

**8.1 Create a mapping**
- Required script call: `map.create(...)`
- Result: failure
- Exact issue: no `map.create` tool is exposed in this MCP client/tool surface
- Recovery call: `map.list({})`
- Result: success
- Key output: existing mappings are `material-button` and `chakra-button`

**8.2 Resolve the mapping**
- Call: `map.resolve({ externalSystem: "material-ui", externalComponent: "MuiDataGrid" })`
- Result: failure
- Key output: `status: "not_found"`
- Notes: The error message helpfully says to use `map.create`, but that tool is not available here.

**8.3 Delete the mapping**
- Could not execute as scripted because 8.1 never produced a created mapping ID.
- Result: failed

### Phase 9: Edge Cases

**9.1 Invalid object**
- Call: `design.compose({ intent: "A detail view for a made-up object", object: "NonExistentThing" })`
- Result: graceful error payload
- Key output: `code: "OODS-S004"`, available object list included
- Notes: Good error quality.

**9.2 Invalid schemaRef**
- Attempt 1 call: `repl.validate({ schemaRef: "bogus-ref-12345" })`
- Result: failure at input-contract layer
- Exact error: `missing required field: 'patch'`
- Recovery call: `repl.validate({ schemaRef: "bogus-ref-12345", mode: "full" })`
- Result: graceful invalid payload
- Key output: `status: "invalid"`, `code: "OODS-N003"`

**9.3 Empty intent**
- Call: `design.compose({ intent: "" })`
- Result: graceful validation failure
- Exact error: `must NOT have fewer than 1 characters`
- Notes: Good behavior, though this is enforced at tool validation rather than server logic.

**9.4 Very long intent**
- Call: `design.compose({ intent: "<500+ word operations dashboard prompt>" })`
- Result: success
- Key output: `schemaRef: "compose-186eb05a"`, `layout: "detail"`, `objectAutoDetected: "Organization"`, `slotsExpanded: 5`
- Notes: The result is worse than the concise intent. A dashboard-heavy prompt collapses into another detail-with-tabs scaffold rather than a true dashboard.

---

## Top Issues

1. **[HIGH] `map.create` is still unusable from this session's MCP tool surface** - Phase 8 cannot be completed as scripted because the create tool is not exposed, even though error text suggests it exists.
2. **[HIGH] The test script and live API contract still diverge in multiple places** - `repl.validate`, `repl.render`, `pipeline`, and `viz.compose` all required recovery calls because the script payloads are stale.
3. **[HIGH] React code generation still emits unbound identifiers** - Task 4.1 produced JSX that references values like `classificationMetadata` without reading them from props, so the generated file is not compile-ready.
4. **[MEDIUM] Compose selection metadata is ahead of emitted tree quality** - The system often identifies better candidates in `selections`, but the actual schema tree still renders generic `Text`, `Stack`, and empty tab panels.
5. **[MEDIUM] Long-intent handling is structurally weak** - A realistic 500+ word dashboard request still became a generic detail scaffold with tabs instead of a dashboard layout.
6. **[LOW] Catalog filtering is discoverable only if you notice `availableCategories`** - Script examples like `badge` are not valid categories, and the empty response does not actively steer the user toward valid values.

---

## Usability Observations

- **What was intuitive?**
  - `health`, `object.list`, `object.show`, and baseline `design.compose`
  - `schema.load`, `schema.list`, `schema.delete`
  - Pipeline response structure after recovery

- **What was confusing?**
  - `repl.validate` and `repl.render` requiring `mode: "full"` when the script omits it
  - Pipeline expecting `styling` at top level while the script puts it inside `options`
  - Visualization using `dataBindings` instead of the script's `data` object

- **What was missing?**
  - `map.create` in the current client/tool surface
  - Better alignment between `selections` and the actual emitted schema tree
  - Cleaner HTML output if `framework: "html"` is meant to be directly browser-ready

- **What surprised you?**
  - Pipeline save with `{ name, tags }` now works and persists tags correctly
  - Backend latency is consistently low; most of the friction is payload reading and contract recovery
  - Invalid object and invalid schemaRef errors are specific and actionable once the call reaches server logic

---

## Schema Quality Assessment

| Compose Result | Component selection | Layout structure | Trait integration | Slot filling | Notes |
|---|---:|---:|---:|---:|---|
| Product detail (2.1) | 2/5 | 3/5 | 3/5 | 1/5 | Strong metadata, weak actual content binding |
| User list (2.2) | 2/5 | 3/5 | 3/5 | 2/5 | Footer pagination still lands as `Text` in the tree |
| Settings form (2.3) | 2/5 | 3/5 | 1/5 | 2/5 | Works without object, but field intent collapses to one editor type |
| Long intent (9.4) | 2/5 | 2/5 | 3/5 | 1/5 | Auto-detected Organization traits, but wrong overall structure |

---

## Code Generation Quality

| Codegen Result | Syntactic correctness | Idiomatic style | Token usage | Completeness | Notes |
|---|---:|---:|---:|---:|---|
| React (4.1) | 2/5 | 3/5 | 4/5 | 2/5 | Good typings/imports, but emitted identifiers are out of scope |
| Vue (4.2) | 4/5 | 3/5 | 3/5 | 2/5 | Valid SFC shape, but still mostly empty scaffold content |
| HTML (4.3) | 4/5 | 3/5 | 5/5 | 2/5 | Parses, but still contains template placeholders and generic content |

---

## Final Verdict

I would use this tool for discovery, schema exploration, and rough scaffolding, but not yet as a direct design-to-code handoff path. The single biggest thing holding it back is the gap between the system's internal understanding of the intent and the quality of the emitted tree/code: it often knows the right direction, but still outputs generic slots, weak bindings, or non-compiling React.


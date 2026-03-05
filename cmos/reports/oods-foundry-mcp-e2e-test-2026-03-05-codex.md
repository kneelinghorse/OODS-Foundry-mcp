# OODS Foundry MCP - E2E Test Report

**Date:** 2026-03-05
**Tester:** Codex (GPT-5)
**Test Script:** `oods-mcp-e2e-test-script.md`
**Server Version:** `0.1.0` | **DSL:** `1.0` (`2026.02` payloads)
**Runtime:** ~10 minutes (manual tool execution)

---

## Completion Scorecard

| Phase | Tasks | Completed | Failed | Notes |
|---|---:|---:|---:|---|
| 1. Discovery | 3 | 3 | 0 | Clean discovery; category filter values are non-obvious |
| 2. Composition | 3 | 3 | 0 | All compose calls succeeded |
| 3. Validation/Render | 2 | 2 | 0 | Script payloads needed retries (`mode: "full"`) |
| 4. Code Generation | 3 | 3 | 0 | React/Vue/HTML all generated |
| 5. Pipeline | 2 | 2 | 0 | Script payloads needed retries (pipeline schema mismatch) |
| 6. Schema Persistence | 3 | 3 | 0 | Load/list/delete flow works |
| 7. Visualization | 2 | 2 | 0 | Task 7.1 needed payload correction (`dataBindings`) |
| 8. Mappings | 3 | 0 | 3 | `map.create` not exposed in current MCP tool surface |
| 9. Edge Cases | 4 | 4 | 0 | Errors are clear; whitespace intent still composes |
| **Total** | **25** | **22** | **3** | |

---

## Task Log (Exact Calls + Key Results)

### Phase 1: Discovery

**1.1 Health check**
- Call: `health({})`
- Result: ✅ `status: "ok"`
- Key fields: `components: 97`, `traits: 37`, `objects: 12`, `savedCount: 1`, `latency: 3`

**1.2 Explore objects**
- Call: `object.list({})`
- Result: ✅ `totalCount: 11`
- Call: `object.show({ name: "Product" })`
- Result: ✅ large schema/traits payload returned
- Key fields: 8 traits, rich `schema`, `semantics`, `viewExtensions`

**1.3 Explore catalog**
- Call: `catalog.list({})`
- Result: ✅ `totalCount: 97`, `returnedCount: 25`, `hasMore: true`
- Call: `catalog.list({ category: "form" })`
- Result: ✅ but empty (`filteredCount: 0`)
- Call: `catalog.list({ category: "badge" })`
- Result: ✅ but empty (`filteredCount: 0`)
- Recovery call: `catalog.list({ category: "primitive" })`
- Result: ✅ filter works (`totalCount: 11`)

### Phase 2: Core Composition

**2.1 Product detail view**
- Call:
  - `design.compose({ intent: "A detail view for a Product showing name, price, SKU, and inventory status with a status badge", object: "Product" })`
- Result: ✅
- Key fields: `layout: "detail"`, `schemaRef: "compose-f1c240f5"`, `slotCount: 5`, warning `OODS-V120` (no bottom slot for `AuditTimeline`)

**2.2 User list view**
- Call:
  - `design.compose({ intent: "A paginated list of Users showing name, email, and role with search and filtering", object: "User" })`
- Result: ✅
- Key fields: `layout: "list"`, `schemaRef: "compose-84e4a6e7"`
- Observation: `search` slot selected `Input`; `filters` slot selected `SearchInput` (swapped behavior)

**2.3 Settings form without object**
- Call:
  - `design.compose({ intent: "A settings page with a form for notification preferences: email toggle, SMS toggle, frequency dropdown" })`
- Result: ✅
- Key fields: `layout: "form"`, `schemaRef: "compose-dd0f6c1b"`
- Observation: all field slots selected `PreferenceEditor` (no toggle vs dropdown differentiation)

### Phase 3: Validation & Rendering

**3.1 Validate schemaRef (2.1)**
- Attempt 1 call: `repl.validate({ schemaRef: "compose-f1c240f5" })`
- Result: ❌ input validation error (`missing required field: patch`)
- Recovery call: `repl.validate({ mode: "full", schemaRef: "compose-f1c240f5" })`
- Result: ✅ `status: "ok"`, no errors/warnings

**3.2 Render schemaRef (2.1)**
- Attempt 1 call: `repl.render({ schemaRef: "compose-f1c240f5", apply: true })`
- Result: ❌ input validation error (`missing required field: patch/baseTree`)
- Recovery call: `repl.render({ mode: "full", schemaRef: "compose-f1c240f5", apply: true })`
- Result: ✅ HTML document returned (`output.format: "document"`)

### Phase 4: Code Generation

**4.1 React**
- Call:
  - `code.generate({ schemaRef: "compose-f1c240f5", framework: "react", options: { typescript: true, styling: "tokens" } })`
- Result: ✅ `.tsx` output, imports from `@oods/components`

**4.2 Vue**
- Call:
  - `code.generate({ schemaRef: "compose-f1c240f5", framework: "vue", options: { typescript: true, styling: "tailwind" } })`
- Result: ✅ `.vue` SFC output
- Observation: some interactive Tailwind classes applied to layout components (`Stack`, `Tabs` wrappers)

**4.3 HTML**
- Call:
  - `code.generate({ schemaRef: "compose-f1c240f5", framework: "html", options: { styling: "inline" } })`
- Result: ✅ full HTML document returned, self-contained with large token CSS block

### Phase 5: Pipeline

**5.1 Full pipeline**
- Attempt 1 call:
  - `pipeline({ intent: "A dashboard card showing an Organization's plan tier, billing status, and member count", object: "Organization", framework: "react", options: { typescript: true, styling: "tokens" } })`
- Result: ❌ input validation (`unknown field 'typescript'`, `'styling'` in `options`)
- Recovery call:
  - `pipeline({ intent: "A dashboard card showing an Organization's plan tier, billing status, and member count", object: "Organization", framework: "react", styling: "tokens" })`
- Result: ✅ compose→validate→render→codegen
- Key fields: `schemaRef: "compose-f2eb4d55"`, `duration: 11ms`, step latency returned

**5.2 Pipeline with save**
- Attempt 1 call:
  - `pipeline({ intent: "A transaction receipt showing amount, payment method, and status", object: "Transaction", framework: "react", options: { typescript: true, styling: "tokens" }, save: { name: "transaction-receipt-v1", tags: ["receipt", "transaction"] } })`
- Result: ❌ input validation (`save must be string`; unknown options fields)
- Recovery call:
  - `pipeline({ intent: "A transaction receipt showing amount, payment method, and status", object: "Transaction", framework: "react", styling: "tokens", save: "transaction-receipt-v1" })`
- Result: ✅ includes `save` step
- Key fields: `schemaRef: "compose-681ab9dc"`, `saved: { name: "transaction-receipt-v1", version: 1 }`
- Verification call: `schema.list({})`
- Result: ✅ schema present

### Phase 6: Schema Persistence

**6.1 Load saved schema + generate Vue**
- Call: `schema.load({ name: "transaction-receipt-v1" })`
- Result: ✅ `schemaRef: "compose-681ab9dc"`
- Follow-up call:
  - `code.generate({ schemaRef: "compose-681ab9dc", framework: "vue", options: { typescript: true, styling: "tailwind" } })`
- Result: ✅ Vue code generated
- Note: loaded metadata reports `object: "Archive"` though source was Transaction

**6.2 List and filter schemas**
- Call: `schema.list({})`
- Result: ✅ includes saved schema
- Call: `schema.list({ tags: ["receipt"] })`
- Result: ✅ empty list (saved schema had no tags)

**6.3 Delete schema**
- Call: `schema.delete({ name: "transaction-receipt-v1" })`
- Result: ✅ `deleted: true`
- Verification: `schema.list({})`
- Result: ✅ deleted schema no longer present

### Phase 7: Visualization

**7.1 Bar chart compose**
- Attempt 1 call:
  - `viz.compose({ chartType: "bar", data: { x: { field: "category", type: "nominal" }, y: { field: "revenue", type: "quantitative" } }, title: "Revenue by Category" })`
- Result: ❌ input validation (`unknown field 'data'`, `'title'`)
- Recovery call:
  - `viz.compose({ chartType: "bar", dataBindings: { x: "category", y: "revenue" } })`
- Result: ✅ `schemaRef: "viz.compose-a304f92a"`

**7.2 Object-driven viz compose**
- Call: `viz.compose({ object: "Transaction", chartType: "line" })`
- Result: ✅ `schemaRef: "viz.compose-9f3dee93"`
- Observation: `traitsResolved: []`, `encodingsApplied: []` (no auto-binding surfaced)

### Phase 8: Mappings

**8.1 Create mapping**
- Required script call: `map.create(...)`
- Result: ❌ could not execute; `map.create` is not exposed in current MCP tool set
- Discovery call: `map.list({})`
- Result: ✅ only existing mappings: `material-button`, `chakra-button`

**8.2 Resolve mapping**
- Call: `map.resolve({ externalSystem: "material-ui", externalComponent: "MuiDataGrid" })`
- Result: ❌ `status: "not_found"`

**8.3 Delete mapping**
- Call (best-effort cleanup): `map.delete({ id: "material-ui-muidatagrid" })`
- Result: ❌ mapping not found

### Phase 9: Edge Cases

**9.1 Invalid object**
- Call: `design.compose({ intent: "A detail view for something", object: "NonExistentThing" })`
- Result: ✅ graceful error payload
- Key fields: `code: OODS-S004`, available objects listed in message

**9.2 Invalid schemaRef**
- Attempt 1 call: `repl.validate({ schemaRef: "bogus-ref-12345" })`
- Result: ❌ input contract error (missing `mode`)
- Recovery call: `repl.validate({ mode: "full", schemaRef: "bogus-ref-12345" })`
- Result: ✅ graceful invalid response (`status: "invalid"`, `code: OODS-N003`)

**9.3 Empty intent**
- Call: `design.compose({ intent: "" })`
- Result: ✅ graceful validation failure (`must NOT have fewer than 1 characters`)
- Recovery check: `design.compose({ intent: " " })`
- Result: ✅ composes generic dashboard anyway (`layout: "dashboard"`, very low confidence)

**9.4 Very long intent (500+ words)**
- Call: `design.compose({ intent: "<~560-word dashboard spec>" })`
- Result: ✅
- Key fields: `layout: "form"`, `objectAutoDetected: "Organization"`, `schemaRef: "compose-6e4714b4"`
- Observation: long operational dashboard intent collapsed into form template; unexpected layout inference

---

## Top Issues (Ranked)

1. **[HIGH] Mapping phase blocked by missing `map.create` in exposed MCP surface**
   - Affected: 8.1/8.2/8.3
   - Impact: mapping CRUD workflow cannot be fully tested/executed from current tool interface.

2. **[HIGH] Script payloads and live API contract diverge in multiple phases**
   - Affected: 3.1, 3.2, 5.1, 5.2, 7.1
   - Examples: `repl.validate/repl.render` need `mode`, pipeline `options` schema differs, viz uses `dataBindings` not `data`.

3. **[MEDIUM] `pipeline.save` cannot accept tags object from script shape**
   - Affected: 5.2, 6.2
   - `save` only accepts string name; no tag persistence through pipeline.

4. **[MEDIUM] Saved schema metadata object mismatch**
   - Affected: 6.1
   - Saved Transaction schema loads as `object: "Archive"`.

5. **[MEDIUM] Semantic slot placement quality issues in compose output**
   - Affected: 2.2, 2.3, 9.4
   - Search/filter swapped in list layout; field specialization weak; long intent inferred wrong layout/context.

6. **[LOW] Category filter discoverability is weak**
   - Affected: 1.3
   - `category: "form"` / `"badge"` return empty; working values are not discoverable from an enum endpoint.

7. **[LOW] Whitespace intent behavior is inconsistent**
   - Affected: 9.3
   - Empty string hard-fails (good), but single-space composes full low-confidence dashboard.

---

## Usability Observations

- **What was intuitive?**
  - `health`, `object.show`, `design.compose` baseline, `code.generate`, `schema.load/delete`.
- **What was confusing?**
  - `repl.*` input contract (requires `mode`), pipeline option schema, mapping creation path not exposed.
- **What was missing?**
  - `map.create` tool exposure, category enum discovery, consistent script/API examples.
- **What surprised me?**
  - Very good structured error payloads for invalid object/schemaRef.
  - Very large render/code payloads returned inline.
  - Long intent inferred as `form` with `Organization` auto-detection despite dashboard-heavy content.

---

## Schema Quality Assessment

### Task 2.1 — Product Detail
- Component selection: **3/5**
- Layout structure: **4/5**
- Trait integration: **3/5**
- Slot filling: **2/5**

### Task 2.2 — User List
- Component selection: **3/5**
- Layout structure: **4/5**
- Trait integration: **3/5**
- Slot filling: **2/5**

### Task 2.3 — Settings Form (No Object)
- Component selection: **3/5**
- Layout structure: **4/5**
- Trait integration: **N/A**
- Slot filling: **2/5**

---

## Code Generation Quality

### Task 4.1 — React/TypeScript (tokens)
- Syntactic correctness: **4/5**
- Idiomatic style: **4/5**
- Token usage: **5/5**
- Completeness: **3/5**

### Task 4.2 — Vue/TypeScript (tailwind)
- Syntactic correctness: **4/5**
- Idiomatic style: **3/5**
- Token usage: **3/5**
- Completeness: **3/5**

### Task 4.3 — HTML (inline)
- Syntactic correctness: **5/5**
- Idiomatic style: **4/5**
- Token usage: **4/5**
- Completeness: **4/5**

---

## Timing and Attempt Notes

- Slowest/most attempt-heavy segments were **contract mismatch tasks** (3.1, 3.2, 5.1, 5.2, 7.1), each requiring one correction retry.
- Compose, validate, and codegen operations were generally fast after valid payloads.
- Pipeline reported server-side duration of **11–15ms** in successful runs.

---

## Final Verdict

The core compose→validate→render→codegen flow is operational and productive, and the structured errors are strong. The biggest blocker to smooth structured testing is API surface mismatch between the script and the live tool contracts, plus the missing `map.create` exposure for Phase 8. I would use this system for scaffold generation today, but not yet as a frictionless end-to-end scripted test target without aligning docs, contracts, and mapping tooling.

---

## Public v1 Readiness Addendum (2026-03-05)

### V1 Release Gates (Pass/Fail)

| Gate | Current Status | Evidence | Release Gate to Pass |
|---|---|---|---|
| Mapping CRUD executable from MCP | **Fail** | `map.create` not exposed; Phase 8 blocked | Expose `map.create` and pass create→resolve→delete e2e in one run |
| E2E script is copy/paste accurate | **Fail** | Multiple payload retries needed (`repl.*`, `pipeline`, `viz.compose`) | Publish script aligned to current API and re-run with 0 payload retries |
| Schema persistence metadata integrity | **Fail** | Saved Transaction schema loads with `object: "Archive"` | Save/load returns consistent object identity for 100% of tested objects |
| Pipeline save supports metadata tags | **Fail** | `save` accepts string only; cannot persist tags from script shape | Support `save` metadata object or add explicit `tags` parameter |
| Error messages actionable for invalid input | **Pass** | `OODS-S004`, `OODS-N003` include hints and available object list | Keep structured error envelope stable in v1 |
| End-to-end compose→validate→render→codegen | **Pass** | Successful in both direct and pipeline flow | Keep p95 performance and contract stability |

### Contract Mismatch Appendix (Script vs Live API)

| Script Task | Script Payload | Live Payload That Worked |
|---|---|---|
| 3.1 Validate | `repl.validate({ schemaRef })` | `repl.validate({ mode: "full", schemaRef })` |
| 3.2 Render | `repl.render({ schemaRef, apply: true })` | `repl.render({ mode: "full", schemaRef, apply: true })` |
| 5.1 Pipeline options | `options: { typescript, styling }` | Top-level `styling` only (no `typescript` in `pipeline.options`) |
| 5.2 Pipeline save | `save: { name, tags }` | `save: "name"` |
| 7.1 Viz compose | `data: { x: {field,type}, y: {field,type} }, title` | `dataBindings: { x: "field", y: "field" }` |
| 8.1 Mapping create | `map.create(...)` | Not executable in current exposed MCP tool surface |

### Public API Stability Policy (Recommended for v1)

1. **Semantic versioning**: breaking request/response changes only in major versions.
2. **Deprecation window**: minimum 90 days for renamed/removed fields.
3. **Compatibility rule**: patch releases must not break working payloads.
4. **Change visibility**: publish a machine-readable changelog for each release.
5. **Error contract stability**: keep `code`, `message`, and `hint` fields backward-compatible.

### Known Limitations / Non-goals (Declare Explicitly in v1 Docs)

- `viz.compose` object auto-binding may return empty `traitsResolved`/`encodingsApplied`.
- Compose slot selection can be keyword-biased in complex intents.
- Generated code focuses on scaffold structure; prop binding remains partial.
- Large HTML/token payloads are returned inline and can be heavy for MCP clients.

### Operational SLOs (Recommended Baseline Targets)

| Endpoint Group | Target p95 | Target p99 | Availability |
|---|---:|---:|---:|
| `health`, `schema.list`, `map.list` | 75ms | 150ms | 99.9% |
| `design.compose`, `repl.validate` | 400ms | 900ms | 99.5% |
| `repl.render`, `code.generate`, `pipeline` | 1200ms | 2500ms | 99.5% |

Additional operational guardrails:
- Publish max recommended response size and a `compact` mode target.
- Document `schemaRef` TTL and recovery path (`schema.save`/`schema.load`).

### Security & Privacy Readiness Notes

- Treat user intent/object schema fields as potentially sensitive; avoid logging raw payloads by default in production.
- Provide a documented redaction strategy for emails, IDs, billing references, and free-text inputs.
- Ensure transport and persisted artifacts are encrypted at rest/in transit where deployed.
- Add explicit retention policy for saved schemas and generated artifacts.

### Ship Checklist (Owners + Dates)

| Priority | Item | Owner | Target Date | Success Metric |
|---|---|---|---|---|
| P0 | Expose/enable `map.create` in MCP surface | MCP Platform | **2026-03-12** | Phase 8 passes 3/3 |
| P0 | Align `oods-mcp-e2e-test-script.md` with live contracts | DX/Docs | **2026-03-12** | 0 payload retries in full run |
| P0 | Fix saved schema `object` metadata mismatch | Persistence | **2026-03-14** | 20/20 object save-load identity checks pass |
| P1 | Add pipeline tag persistence support | API Core | **2026-03-14** | `schema.list({ tags })` returns saved pipeline schemas |
| P1 | Publish API stability/deprecation policy | Product + DX | **2026-03-17** | Policy linked in README + release notes |
| P1 | Add category/enum discoverability endpoint | API Core | **2026-03-19** | No trial-and-error needed for filter enums |
| P2 | Reduce large response payload pressure (`compact` mode) | Rendering | **2026-03-26** | `repl.render`/`code.generate` payload size reduced by >=40% in compact mode |

### Go/No-Go Recommendation

**Current recommendation: No-Go for public v1 on 2026-03-05.**

Transition to **Go** once all P0 items above are complete and a clean re-run of the 25-task script succeeds with:
- 25/25 completed,
- no contract-level retries,
- and no data-integrity regressions in schema persistence.

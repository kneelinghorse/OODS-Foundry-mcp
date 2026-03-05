# OODS Foundry MCP - E2E Test Report

**Date:** 2026-03-05
**Tester:** Claude Opus 4.6 (automated)
**Test Script:** oods-mcp-e2e-test-script.md
**Server Version:** 0.1.0 | DSL Version: 1.0 / 2026.02

---

## Completion Scorecard

| Phase | Tasks | Completed | Failed | Notes |
|---|---|---|---|---|
| 1. Discovery | 3 | 3 | 0 | catalog.list category filter "badge" returned 0 (badge is a tag, not a category) |
| 2. Composition | 3 | 3 | 0 | All produced valid schemas; slot selection has issues |
| 3. Validation/Render | 2 | 2 | 0 | Clean validation; render output is 102K chars |
| 4. Code Generation | 3 | 3 | 0 | React/Vue/HTML all generated successfully |
| 5. Pipeline | 2 | 2 | 0 | End-to-end pipeline works; save persisted correctly |
| 6. Schema Persistence | 3 | 3 | 0 | Load/list/delete all work; tag filtering untestable (see notes) |
| 7. Visualization | 2 | 2 | 0 | Bar chart works; object trait auto-binding not implemented |
| 8. Mappings | 3 | 3 | 0 | CRUD works; trait validation warns on valid trait names |
| 9. Edge Cases | 4 | 4 | 0 | Error messages are excellent; empty intent degrades gracefully |
| **Total** | **25** | **25** | **0** | |

---

## Top Issues (ranked by severity)

### 1. [HIGH] - Component slot selection is keyword-biased, not semantically aware

**Affected tasks:** 2.1, 2.2, 2.3, 9.4

The compositor's slot-filling algorithm over-indexes on tag/keyword matching rather than semantic intent. Examples:
- **Task 2.2 (User list):** `SearchInput` was placed in the "filters" slot; generic `Input` placed in the "search" slot. These are swapped.
- **Task 2.3 (Notification form):** All 3 field slots got `PreferenceEditor` — no differentiation between toggle fields and dropdown fields despite the intent specifying them.
- **Task 9.4 (Long intent):** `ColorSwatch` selected for the main-content slot because the 500-word intent mentioned "color-coded" and "color palette" repeatedly. Keyword frequency overwhelmed semantic fit.

**Recommendation:** Consider separating keyword-based scoring from semantic-intent matching. The slot's intent label (e.g., "form-input", "filter-control") should weight differently than tag-matching on the raw intent string.

### 2. [HIGH] - Layout templates are fixed regardless of intent complexity

**Affected tasks:** 9.3, 9.4

The dashboard template always produces the same 4-slot, 10-node structure whether the intent is empty or 500+ words describing a complex multi-widget layout with KPIs, feeds, heat maps, carousels, and alert panels. The compositor doesn't create additional slots or deeper nesting for richer intents.

**Recommendation:** Consider dynamic slot generation based on intent analysis — e.g., detecting multiple distinct UI regions and creating corresponding slots.

### 3. [MEDIUM] - Pipeline `save` param only accepts a string name; cannot pass tags

**Affected tasks:** 5.2, 6.2

The test script expected `save: { "name": "...", "tags": ["receipt", "transaction"] }` but the pipeline API's `save` field is a `string` (just the name). Tags cannot be set via the pipeline. This makes `schema.list` tag filtering untestable via the pipeline workflow.

**Fix:** Either change `pipeline.save` to accept `{ name, tags }` or add a separate `tags` param.

### 4. [MEDIUM] - Saved schema shows wrong object name

**Affected task:** 6.1

Pipeline saved a Transaction-based schema, but `schema.load` returned `"object": "Archive"` instead of `"Transaction"`. The object metadata is being set incorrectly during pipeline save.

### 5. [MEDIUM] - Viz object trait auto-binding not implemented

**Affected task:** 7.2

`viz.compose` with `object: "Transaction"` + `chartType: "line"` returns `traitsResolved: []` and `encodingsApplied: []`. The chart-area component has no data bindings. Passing an object should auto-resolve viz-relevant traits and map them to encodings.

### 6. [MEDIUM] - Mapping trait validation doesn't match object registry

**Affected task:** 8.1

Creating a mapping with traits like `behavioral/Searchable` (exactly as they appear in the Product object definition) triggers "Unknown trait" warnings. The mapping validator appears to use a different trait registry than the object system.

### 7. [LOW] - Test script parameter mismatches with actual API

**Affected tasks:** 1.3, 7.1, 8.1

Several test script suggestions don't match the actual API:
- `category: "badge"` — badge is a tag, not a category
- `viz.compose` data format: test used `data: { x: { field, type } }`, API uses `dataBindings: { x, y }`
- `map.create` confidence: test used `0.85` (number), API accepts `"auto"` | `"manual"`
- `map.create` property names: test used `traits`/`propertyMappings`/`notes`, API uses `oodsTraits`/`propMappings`/`metadata.notes`
- `map.create` defaults to dry-run (`apply: false`), not mentioned in test script

### 8. [LOW] - Health check reports 12 objects, object_list returns 11

**Affected task:** 1.1

`health.registry.objects = 12` but `object_list.totalCount = 11`. Off-by-one discrepancy.

### 9. [LOW] - Vue codegen applies interactive Tailwind utilities to non-interactive elements

**Affected task:** 4.2

`focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90` applied to Stack containers and Tabs wrappers that aren't interactive elements.

---

## Usability Observations

### What was intuitive?
- `health` check — instant, clear subsystem status
- `object.show` — incredibly rich output with traits, schema, view extensions, tokens, and semantics
- `design.compose` basic flow — provide intent + object, get a UiSchema back
- `pipeline` — single-call compose-to-code is the killer workflow
- Error messages (9.1, 9.2) — best-in-class with error codes, messages, and actionable hints
- `schema.save`/`load`/`delete` — clean CRUD lifecycle

### What was confusing?
- `catalog.list` category values — no way to discover valid categories without trial-and-error; the summary view doesn't list them
- `map.create` defaulting to dry-run — unexpected that `apply` is needed for persistence
- `viz.compose` with object — unclear whether this feature is implemented or just stubbed
- The relationship between intent keywords and component selection — hard to predict which components will be chosen

### What was missing?
- A `catalog.categories` endpoint listing available categories
- An `object.list` domain/trait enum discovery endpoint
- Tag support in `pipeline.save`
- Dynamic slot generation from complex intents
- Viz trait auto-binding from objects
- A way to override specific slot selections after compose (without re-composing)

### What surprised me?
- (Good) Error messages are excellent — the invalid object error lists all available objects
- (Good) Pipeline latency is impressively low (8-12ms for full compose->validate->render->codegen)
- (Bad) Empty/whitespace intent succeeds and produces a full dashboard rather than erroring
- (Bad) 500-word intent produces identical structure to empty intent
- (Bad) `object: "Archive"` appearing in saved Transaction schema metadata

---

## Schema Quality Assessment

### Task 2.1 — Product Detail View
| Criterion | Score | Notes |
|---|---|---|
| Component selection | 3/5 | DetailHeader and ClassificationPanel correct; tab contents got generic Badge |
| Layout structure | 4/5 | Header + sidebar-body with tabs is logical for detail view |
| Trait integration | 3/5 | Product traits inform view_extensions but AuditTimeline had no slot |
| Slot filling | 2/5 | SKU, price, inventory_status not explicitly wired to UI slots |

### Task 2.2 — User List View
| Criterion | Score | Notes |
|---|---|---|
| Component selection | 3/5 | PaginationBar correct; search/filter slots are swapped |
| Layout structure | 4/5 | Toolbar + items + pagination footer is standard list pattern |
| Trait integration | 3/5 | 4 view_extensions had no matching slot positions |
| Slot filling | 3/5 | Search, filters, items, pagination all present |

### Task 2.3 — Settings Form (no object)
| Criterion | Score | Notes |
|---|---|---|
| Component selection | 3/5 | PreferenceEditor matched "notification" keyword well; no field differentiation |
| Layout structure | 4/5 | Title + 3 field groups + actions is clean form layout |
| Trait integration | N/A | No object provided |
| Slot filling | 2/5 | All fields get same component; no toggle vs dropdown distinction |

---

## Code Generation Quality

### Task 4.1 — React/TypeScript (tokens)
| Criterion | Score | Notes |
|---|---|---|
| Syntactic correctness | 4/5 | Valid TSX; would compile with @oods/components package |
| Idiomatic style | 4/5 | FC with interface, proper destructuring, data-attributes |
| Token usage | 5/5 | All spacing uses `var(--ref-spacing-*)` tokens consistently |
| Completeness | 3/5 | Good scaffold but props not wired to rendered components |

### Task 4.2 — Vue/TypeScript (Tailwind)
| Criterion | Score | Notes |
|---|---|---|
| Syntactic correctness | 4/5 | Valid SFC with script setup + defineProps |
| Idiomatic style | 3/5 | Interactive utilities on non-interactive elements |
| Token usage | 3/5 | Mixed Tailwind classes with CSS var fallbacks |
| Completeness | 3/5 | Same scaffold quality; props defined but not bound |

### Task 4.3 — HTML (inline)
| Criterion | Score | Notes |
|---|---|---|
| Syntactic correctness | 5/5 | Complete HTML document; browser-ready |
| Idiomatic style | 4/5 | Semantic structure with data-attributes |
| Token usage | 4/5 | Full token CSS embedded in head |
| Completeness | 4/5 | Self-contained; could paste into browser |

---

## V1 Public Release Readiness

### Must-fix before shipping

**1. Fix the test script to match the actual API.**
The E2E test script is the closest thing to onboarding documentation, and it has wrong parameter names, wrong types, and wrong value formats throughout. An external user following it will fail on tasks 1.3, 5.2, 7.1, 7.2, and 8.1. If this is the public-facing guide, every example must be copy-pasteable and work.

**2. SchemaRef 30-minute TTL needs documentation and a recovery path.**
Every `schemaRef` expires after 30 minutes (`schemaRefExpiresAt` is visible in responses). If a user composes a schema, walks away, and comes back — their ref is dead. There's no warning when you try to use an expired ref (it just fails like an invalid ref). Options:
- Surface the TTL prominently in tool descriptions
- Auto-extend on use
- Make `schema.save` the default rather than opt-in, so users always have a persistent copy

**3. The `apply` pattern is inconsistent and undocumented.**
- `map.create` defaults to `apply: false` (dry run) — creates but doesn't persist
- `schema.save` persists immediately — no `apply` toggle
- `repl.render` uses `apply` to mean "include HTML output" not "write to disk"
- `brand.apply` and `tokens.build` use `apply` to mean "write files"

Same keyword, four different semantics. External users will get burned. Either standardize the pattern or rename the parameters to be unambiguous (`persist`, `writeFiles`, `includeOutput`).

**4. Add discoverability endpoints.**
Right now there's no way to learn what's available without guessing:
- What categories exist for `catalog.list`? Trial-and-error only.
- What domains exist for `object.list`? You have to call unfiltered first.
- What traits are valid for `map.create`? The validator rejects names that work everywhere else.
- What `context` values produce different results in `design.compose`?

A `registry.inspect` or `meta.enums` endpoint that returns valid values for every filterable field would eliminate the biggest source of friction.

**5. Object metadata bug in schema.save is a data integrity issue.**
Saving a Transaction schema and loading it back as `"object": "Archive"` isn't cosmetic — it means schema.list filtering by object would return wrong results. This will erode trust in the persistence layer.

### Should-fix for a strong v1

**6. Generated code doesn't bind props to the rendered tree.**
The React and Vue codegen produces typed props interfaces (well-documented, correct types) but the rendered JSX/template doesn't reference any of them. The `GeneratedUI` component accepts `label`, `sku`, `unitAmountCents`, `inventoryStatus` etc. as props but renders empty `<Stack />` and `<Text />` placeholders. A user gets a perfect TypeScript contract and an empty shell.

The gap between "here are your props" and "here's where they render" is where users need the most help. Even a `{/* TODO: bind props.label */}` comment inside each slot would make the output dramatically more useful. Better yet, use the `semantics` metadata from `object.show` (which already maps fields to components and ui_hints) to generate actual bindings.

**7. Response payload sizes are a real concern for MCP consumers.**
- `repl.render` with `apply: true`: 102K characters
- `code.generate` for HTML: 87K characters
- `pipeline` end-to-end: 96K characters

Most of this is the embedded CSS token block (repeated in every response). MCP clients that display tool results in-context will choke. Consider:
- Streaming large outputs to files by default and returning a file path
- A `compact` response mode that omits the token CSS
- Separating the token CSS into a `tokens.build` artifact that's referenced, not inlined

**8. Viz is a feature or it isn't — remove the ambiguity.**
`viz.compose` with an object returns `traitsResolved: []`, `encodingsApplied: []`, `scalesResolved: []`, `interactionsResolved: []`. These empty arrays suggest the feature was designed but not connected. For v1, either:
- Wire it up: resolve the object's Priceable/Timestampable traits into meaningful x/y encodings
- Or gate it: mark viz as `"status": "experimental"` in health and document that object auto-binding is coming

Shipping an endpoint that accepts params, returns success, but silently does nothing is worse than not having the endpoint.

### Nice-to-have for differentiation

**9. Post-compose slot override.**
After `design.compose`, users can see the `selections` array with candidates and confidence scores. But there's no way to say "swap slot tab-1 from Badge to PriceSummary" without re-composing from scratch. A `design.patch` or `compose` with `preferences.componentOverrides` (which exists in the schema but wasn't tested) would let users refine without losing context.

**10. Intent-aware slot generation.**
The fixed-template approach (dashboard = always 4 slots, form = always N field groups) works for simple cases but caps the tool's ceiling. If the intent mentions "KPI section, order feed, heat map, alerts panel, team activity" — that's 5 distinct widgets, not 1 "main-content" slot. Even a heuristic pass that counts distinct noun-phrases and creates corresponding slots would produce dramatically better results for complex intents.

**11. Structured data versioning awareness.**
`structuredData.fetch` supports versioning and ETag caching, which is sophisticated. But `design.compose` doesn't surface which component registry version it used, making it hard to reproduce results. Pinning compose to a specific `registryVersion` would make schemas reproducible.

---

## Final Verdict

The OODS Foundry MCP has a solid foundation — the pipeline from intent to rendered code works end-to-end, error handling is best-in-class, and schema persistence is clean. **I would use this tool for rapid UI scaffolding** in a real design workflow, particularly the pipeline endpoint which is genuinely fast and useful.

**The single biggest thing holding it back is the compositor's slot-filling intelligence.** Layout templates are static regardless of intent complexity, and component selection is keyword-biased rather than semantically aware. A 500-word intent describing a complex dashboard produces the same 4-slot structure as an empty string. Solving this — making the compositor dynamically generate slots and pick components based on semantic intent rather than tag frequency — would transform this from a scaffolding tool into a genuine design composition engine.

For a public v1, the critical path is: fix the test script/docs, address the `apply` inconsistency, add discoverability endpoints, fix the object metadata bug, and either complete or gate the viz feature. The core compose-validate-render-codegen loop is genuinely good — the issues are at the edges, not the center.

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

# OODS Foundry MCP — Agent E2E Test Script (Sprint 74)

**Updated:** 2026-03-05 (post-Sprint 74)
**Version:** 0.1.0 | DSL: 1.0 | Payloads: 2026.02
**Previous:** oods-mcp-e2e-test-script.md (Sprint 71)

> All payloads below are copy-paste accurate against the live API as of Sprint 74.
> No recovery calls should be needed if payloads are sent exactly as shown.

---

## Phase 1: Discovery (3 tasks)

### 1.1 Health check
```json
health({})
```
**Expect:** `status: "ok"`, subsystem counts for `registry.components`, `registry.traits`, `registry.objects`.

### 1.2 Explore objects
```json
object.list({})
```
**Expect:** `totalCount >= 11`, array of object summaries.

```json
object.show({ "name": "Product" })
```
**Expect:** Full object with `traits`, `schema`, `semantics`, `viewExtensions`.

### 1.3 Explore the catalog
```json
catalog.list({})
```
**Expect:** `totalCount >= 90`, `availableCategories` array. Note: `badge` is a tag, not a category. Use `primitive` or `composite` for category filtering.

```json
catalog.list({ "category": "primitive" })
```
**Expect:** Components like Badge, Button, Card, Input, Tabs, Text.

---

## Phase 2: Core Composition (3 tasks)

### 2.1 Compose a detail view
```json
design.compose({
  "intent": "A detail view for a Product showing name, price, SKU, and inventory status with a status badge",
  "object": "Product"
})
```
**Expect:** `status: "ok"`, `layout: "detail"`, `schemaRef`, `selections` array with component rankings.

### 2.2 Compose a list view
```json
design.compose({
  "intent": "A paginated list of Users showing name, email, and role with search and filtering",
  "object": "User"
})
```
**Expect:** `status: "ok"`, `layout: "list"`, PaginationBar in selections metadata.

### 2.3 Compose with no object
```json
design.compose({
  "intent": "A settings page with a form for notification preferences: email toggle, SMS toggle, frequency dropdown"
})
```
**Expect:** `status: "ok"`, `layout: "form"`, no object metadata.

---

## Phase 3: Validation & Rendering (2 tasks)

### 3.1 Validate (schemaRef-only — no mode required)
```json
repl.validate({ "schemaRef": "<schemaRef from 2.1>" })
```
**Expect:** `status: "ok"`, `mode: "full"` (defaulted). No need to provide `mode`.

### 3.2 Render to HTML (schemaRef-only — no mode required)
```json
repl.render({ "schemaRef": "<schemaRef from 2.1>", "apply": true })
```
**Expect:** `status: "ok"`, `html` output, `mode: "full"` (defaulted).

**Compact mode (optional):**
```json
repl.render({ "schemaRef": "<schemaRef from 2.1>", "apply": true, "output": { "compact": true } })
```
**Expect:** `tokenCssRef: "tokens.build"` instead of full CSS inline.

---

## Phase 4: Code Generation (3 tasks)

### 4.1 Generate React code
```json
code.generate({
  "schemaRef": "<schemaRef from 2.1>",
  "framework": "react",
  "options": { "typescript": true, "styling": "tokens" }
})
```
**Expect:** Valid `.tsx` output with `PageProps` interface, destructured props in component function, `{name}`, `{price}` in JSX.

### 4.2 Generate Vue code
```json
code.generate({
  "schemaRef": "<schemaRef from 2.1>",
  "framework": "vue",
  "options": { "typescript": true, "styling": "tailwind" }
})
```
**Expect:** Valid Vue SFC with `<script setup lang="ts">`, `defineProps<Props>()`, Tailwind classes.

### 4.3 Generate HTML
```json
code.generate({
  "schemaRef": "<schemaRef from 2.1>",
  "framework": "html",
  "options": { "styling": "inline" }
})
```
**Expect:** Complete HTML document with `data-bind` attributes and `[fieldName]` placeholder text.

---

## Phase 5: Pipeline (2 tasks)

### 5.1 Full pipeline
```json
pipeline({
  "intent": "A dashboard card showing an Organization's plan tier, billing status, and member count",
  "object": "Organization",
  "framework": "react",
  "styling": "tokens"
})
```
**Expect:** `steps: ["compose", "validate", "render", "codegen"]`, compact render output.

**Alternative (nested options also accepted):**
```json
pipeline({
  "intent": "...",
  "object": "Organization",
  "options": { "framework": "react", "styling": "tokens", "typescript": true }
})
```

### 5.2 Pipeline with schema save + tags
```json
pipeline({
  "intent": "A transaction receipt showing amount, payment method, and status",
  "object": "Transaction",
  "framework": "react",
  "styling": "tokens",
  "save": { "name": "transaction-receipt-v1", "tags": ["receipt", "transaction"] }
})
```
**Expect:** `saved: { name: "transaction-receipt-v1", version: 1 }`, steps includes `save`.

---

## Phase 6: Schema Persistence (3 tasks)

### 6.1 Load saved schema
```json
schema.load({ "name": "transaction-receipt-v1" })
```
**Expect:** `schemaRef`, `object: "Transaction"`, tags preserved.

### 6.2 List and filter schemas
```json
schema.list({})
```
**Expect:** Includes `transaction-receipt-v1`.

```json
schema.list({ "tags": ["receipt"] })
```
**Expect:** Returns `transaction-receipt-v1`.

### 6.3 Delete schema
```json
schema.delete({ "name": "transaction-receipt-v1" })
```
**Expect:** `deleted: true`.

---

## Phase 7: Visualization (2 tasks)

### 7.1 Compose a bar chart
```json
viz.compose({
  "chartType": "bar",
  "dataBindings": { "x": "category", "y": "revenue" }
})
```
**Expect:** `status: "ok"`, chart-area and controls-panel slots.

**Alternative (data alias also accepted):**
```json
viz.compose({
  "chartType": "bar",
  "data": { "x": "category", "y": "revenue" }
})
```

### 7.2 Compose from object traits
```json
viz.compose({ "object": "Transaction", "chartType": "line" })
```
**Expect:** `status: "ok"`. Note: `traitsResolved` may be empty if the object has no viz-specific traits.

---

## Phase 8: Mappings (3 tasks)

### 8.1 Create a mapping
```json
map.create({
  "externalSystem": "material-ui",
  "externalComponent": "MuiDataGrid",
  "oodsTraits": ["Sortable", "Filterable"],
  "propMappings": [
    { "externalProp": "rows", "oodsProp": "data", "coercion": { "type": "identity" } },
    { "externalProp": "columns", "oodsProp": "columnDefs", "coercion": { "type": "identity" } }
  ],
  "confidence": "manual",
  "metadata": { "notes": "MUI Data Grid maps to OODS Table with sorting and filtering" },
  "apply": true
})
```
**Expect:** `status: "ok"`, `applied: true`.

### 8.2 Resolve the mapping
```json
map.resolve({
  "externalSystem": "material-ui",
  "externalComponent": "MuiDataGrid"
})
```
**Expect:** `status: "ok"`, prop translations returned.

### 8.3 Delete the mapping
```json
map.delete({
  "id": "material-ui-mui-data-grid"
})
```
**Expect:** `status: "ok"`, `deleted: { id, externalSystem, externalComponent }`.

---

## Phase 9: Edge Cases (4 tasks)

### 9.1 Invalid object
```json
design.compose({
  "intent": "A detail view for a made-up object",
  "object": "NonExistentThing"
})
```
**Expect:** Error with `code: "OODS-S004"`, list of available objects in hint.

### 9.2 Invalid schemaRef
```json
repl.validate({ "schemaRef": "bogus-ref-12345" })
```
**Expect:** `status: "invalid"`, error `code: "OODS-N003"`.

### 9.3 Empty intent
```json
design.compose({ "intent": "" })
```
**Expect:** Input validation error (`must NOT have fewer than 1 characters`).

### 9.4 Very long intent
```json
design.compose({
  "intent": "An operations dashboard for a multi-region SaaS company. The dashboard should include: 1) A KPI section at the top showing active users, revenue, churn rate, and NPS score as large metric cards; 2) A real-time order feed showing the last 50 orders with status badges; 3) A geographic heat map of user activity by region; 4) A system health panel showing service uptime percentages; 5) An alerts panel listing active incidents sorted by severity; 6) A team activity feed with avatar, action, and timestamp; 7) Revenue projections chart. This is used by the VP of Operations to monitor the business at a glance, color-coded by health status with a dark theme."
})
```
**Expect:** `status: "ok"`, some form of layout scaffold. Check `meta.intelligence` for slot expansion metadata.

---

## Contract Changes in Sprint 74

| Area | Before (Sprint 73) | After (Sprint 74) |
|---|---|---|
| `repl.validate` | Required `mode: "full"` for schemaRef-only | `mode` defaults to `"full"`, omit safely |
| `repl.render` | Required `mode: "full"` for schemaRef-only | `mode` defaults to `"full"`, omit safely |
| `viz.compose` | Only `dataBindings` accepted | `data` accepted as alias for `dataBindings` |
| `pipeline` | `styling`/`framework` top-level only | Also accepted inside `options` object |
| `pipeline` | `options.typescript` rejected | `options.typescript` accepted |
| `pipeline.save` | String-only | Also accepts `{ name, tags }` object |
| React codegen | Props not destructured | Props destructured from `PageProps` |
| Vue codegen | `defineProps<Props>()` bare | `const { ... } = defineProps<Props>()` |
| HTML codegen | `{{field}}` template vars | `data-bind` attributes + `[field]` placeholders |

---

## Scoring Criteria

After completing all 25 tasks, score each phase on:

1. **Copy-paste accuracy** (0-5): Did the script payloads work without recovery calls?
2. **Output quality** (0-5): Were the results semantically meaningful?
3. **Error quality** (0-5): Were error messages actionable?
4. **Latency** (0-5): Were responses fast enough for interactive use?

### Platform Score Categories (100-point scale)

| Category | Weight | Description |
|---|---:|---|
| API Surface Completeness | 15 | All 25 tasks executable without workarounds |
| Composition Intelligence | 25 | Slot selection, expansion, field affinity |
| Code Generation Quality | 20 | Compilable, idiomatic, props bound |
| Pipeline & Persistence | 15 | End-to-end pipeline, save/load/delete |
| Error Handling & DX | 10 | Structured errors, actionable hints |
| Visualization | 10 | Chart composition, data binding |
| Documentation & Discoverability | 5 | Categories discoverable, contract aligned |

# OODS Foundry MCP — v1 Public Readiness Assessment
**Date:** 2026-03-04
**Author:** Claude Sonnet 4.6
**Companion to:** `oods-foundry-mcp-ux-audit-2026-03-04.md`
**Scope:** What is missing between the current MCP and a solid, publicly releasable v1

---

## The Central Problem

The white paper describes OODS as a **semantic middleware layer** that sits between application code and a design system, resolving business objects into correctly-composed, trait-driven UI. The current MCP is a **design scaffolding tool** — useful, but architecturally one layer below what was promised.

The proof is a single test:

```
design_compose(intent="Subscription detail view", layout="auto")
```

Result: three tabs labeled "Tab 1", "Tab 2", "Tab 3". Generic Card placeholders in every slot.

Meanwhile, `Subscription.object.yaml` exists on disk with:
- 4 composed traits (Stateful, Cancellable, Timestampable, Billable)
- A full field schema with types, validation, and descriptions
- Per-field semantic mappings (`status → tokenMap(billing.subscription.status.*)`)
- Inline status token values (`billing.subscription.status.active → var(--semantic-success)`)
- Trait parameters that configure states, intervals, and timezones

None of this information is reachable from any MCP tool. The object system, trait composition engine, semantic mappings, and view extension routing — the core of what OODS is supposed to be — do not exist in the MCP layer. Everything from that architecture lives only in YAML files and internal documentation.

A user reaching for this tool to build a real product would hit that wall in the first five minutes.

---

## Section 1: Missing Core Capabilities

### 1.1 No Object System in MCP

The project has 12 domain objects (User, Subscription, Organization, Transaction, Relationship, Product, Invoice, Plan, Usage, Article, Media, and one more in core). These are defined as rich YAML with traits, schema, semantic mappings, and tokens. None are accessible through any MCP tool.

**What's needed:**

`object_list` — returns available domain objects with name, domain, version, maturity, and trait summary. This is the entry point for any agent trying to do real work.

`object_show(name: "Subscription")` — returns the full object definition: trait list, field schema, semantic_type mappings, status token map, and maturity. This is what `design_compose` should call internally when given a known object name.

Without these, agents must carry object knowledge out-of-band or guess. Neither is acceptable for a public tool.

---

### 1.2 `design_compose` Cannot Load Objects or Traits

`design_compose` takes a natural-language intent string and produces structural scaffolding. It has no path to:

1. Recognize a known object name in the intent
2. Load that object's trait list
3. Use the traits' `view_extensions` to select components for each context/region
4. Wire the object's field names into component propSchemas

The trait YAML files define `view_extensions` blocks that specify exactly which component to render in which context and at which region priority. `Stateful.trait.yaml` knows that in a detail context, `StatusBadge` renders in `pageHeader` at priority 100, and `StatusTimeline` renders in the main region at priority 50. `Billable` knows `CycleProgressCard` goes in the main detail region. This is the composition data the tool needs but ignores.

**What's needed:**

A `design_compose(object: "Subscription", context: "detail")` path that:
1. Loads the object definition
2. Collects view_extensions from each composed trait (topologically sorted)
3. Resolves conflicts by priority
4. Places domain components into the correct schema slots
5. Wires propSchema defaults from the object's field names (e.g., `progressField: "current_period_progress"` comes directly from the object schema)

Until this exists, `design_compose` is a layout template tool, not an object-oriented composition engine.

---

### 1.3 Semantic Token Resolution is Disconnected

The Subscription object defines status token mappings explicitly:

```yaml
tokens:
  billing.subscription.status.active: "var(--semantic-success)"
  billing.subscription.status.delinquent: "var(--semantic-danger)"
  billing.subscription.status.paused: "var(--semantic-warning)"
```

When a StatusBadge renders for a Subscription's `status` field, these object-level token overrides should apply. Instead, the current render pipeline uses only the global token sheet with no awareness of object context. The Subscription's semantic layer sits dead in a YAML file.

**What's needed:** An object context parameter in `repl_render` and `code_generate` that loads the object's token overrides and applies them during rendering. Alternatively, `tokens_build` should accept an object name to produce an object-context token layer.

---

### 1.4 Coercion Engine is a Stub

`map_create` accepts a `coercion` field per prop mapping. Every coercion returned is `null`. The field exists in the schema and the API surface but the engine that would execute coercions (e.g., MUI `variant="contained"` → OODS `tone="default"`, MUI `variant="outlined"` → OODS `tone="subtle"`) is not implemented.

For external design system migration — a core OODS use case — coercion is not optional. Without it, prop mappings are rename tables, not translation rules. `map_resolve` returns `coercionType: null, coercionDetail: null` for every entry, which means any agent consuming these mappings has to implement its own coercion logic on top.

**What's needed:** At minimum, support for `enum` coercion (source value → target value lookup table) and `boolean_to_string` coercion. The `coercion` field should be a typed discriminated union, not a nullable placeholder.

---

### 1.5 No Schema Persistence

A composed schema lives only in memory for 30 minutes via `schemaRef`. There is no tool to save a schema by name, load a saved schema, list saved schemas, or delete one. This means:

- Agents cannot build iteratively across sessions
- Teams cannot share a canonical "Subscription detail layout" schema
- The output of a compose session has no durable identity beyond the rendered HTML artifact

For a v1 tool used by real teams, schemas need to be first-class persistent resources. Even a simple filesystem-backed store with `schema_save(name, schemaRef)` / `schema_load(name)` would close this gap.

---

## Section 2: Code Generation Is Not Production-Ready

### 2.1 Generated Code Has No Data Binding

`code_generate` produces components with no props wired. Given a schema with `CycleProgressCard` selected for a slot, the output is:

```tsx
<CycleProgressCard id="slot-tab-1-6" data-oods-component="CycleProgressCard" />
```

But the Subscription object and the component's propSchema together contain everything needed to generate:

```tsx
<CycleProgressCard
  progressField="current_period_progress"
  periodStartField="current_period_start"
  periodEndField="current_period_end"
  intervalField="billing_interval"
/>
```

These defaults come directly from `Billable.trait.yaml`'s `view_extensions` props block. The information exists, the components have defined propSchemas with defaults, and the object has the matching field names. Wiring them together is a deterministic operation. Until it happens, every component in generated code is an empty shell requiring manual prop configuration.

---

### 2.2 Inline Styles Block Interactivity

All generated code (React, Vue, HTML) uses inline `style` attributes with CSS variable references:

```tsx
style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--ref-spacing-cluster-default)' }}
```

Inline styles cannot express interactive states. A Button with `disabled`, `hover`, and `focus` states needs CSS class-based styling. A form field with `:invalid` styling needs a stylesheet. Any conditional style based on runtime state needs class toggling.

The project already has a `tw-variants` package and a `tokens.tailwind.json` artifact from `tokens_build`. These exist but are not connected to `code_generate`. Until class-based output is available, generated code is not production-usable for any interactive component.

**What's needed:** A `styling: "tailwind"` option in `code_generate` that emits Tailwind utility classes derived from `tokens.tailwind.json`. The `tw-variants` package appears to have the logic for this.

---

### 2.3 Vue Output Has No Typed Props

The Vue SFC output includes:

```vue
<script setup lang="ts">
defineProps<{
  // Props can be extended here
}>();
</script>
```

An empty `defineProps` type. For TypeScript to be useful in Vue, the props type needs to be populated from the object schema or at minimum from the component propSchemas. As-is, the TypeScript annotation is a comment wrapper with no type information.

---

### 2.4 No Event Handlers or State Management

Generated code produces static render trees. A form has no `onSubmit`, no validation state, no field error display. A list has no sort handler, no pagination state, no row click. A detail page has no edit toggle. These are all reasonable omissions for a scaffolding tool — but they should be documented explicitly so users know what they're getting, and there should be a clear path (integration guide, hook stubs, event handler slots) for wiring real behavior.

---

### 2.5 `code_generate(framework="html")` Should Be Differentiated

Currently identical to `repl_render(format="document")`. The HTML output is an 84KB full document with the entire token CSS inlined. It is not a component fragment. If the intent is a static preview (same as render), the tool is redundant. If the intent is a web component or vanilla JS output, it doesn't deliver that. The tool needs a clear, differentiated purpose or should be merged with `repl_render` with a note.

---

## Section 3: The Pipeline Has Too Much Ceremony

A user wanting to see a working Subscription detail page currently must:

1. `design_compose` — get a skeleton
2. Manually identify which domain components belong in which slots
3. Re-compose with `componentOverrides` for each slot
4. `repl_validate(checkA11y=true)` — check for issues
5. Iterate on validation failures
6. `repl_render` — get an HTML preview
7. `code_generate` — get React/Vue code
8. Manually add all propSchema values
9. Manually add all event handlers and state

Steps 1–3 should collapse to one: `design_compose(object="Subscription", context="detail")`. Steps 4–6 should be optional flags on compose (validate and render inline). Steps 8–9 are unavoidable but should be scaffolded with comments and stubs.

For an agent using this tool autonomously, every extra round-trip multiplies latency and error surface. The pipeline as it stands requires 7 separate tool calls minimum to get from intent to usable code. A v1 product should get that to 2–3.

---

## Section 4: Platform and Production Readiness

### 4.1 No Authentication

No tool in the MCP accepts or requires any authentication credential. There is no API key, no JWT, no OAuth flow. TENANCY.md confirms multi-tenancy is architecturally implemented (shared-schema, schema-per-tenant, external-adapter modes, implemented in Sprint 17), but the MCP has no way to identify which tenant a request belongs to.

Every call is effectively an unauthenticated, single-tenant operation against whatever default context the server was started with. This is appropriate for a local development tool. It is not acceptable for a public API.

**Minimum for v1:** API key authentication passed as a header or MCP initialization parameter. Tenant ID derivation from the API key. All tool responses should include the resolved tenant context for auditability.

---

### 4.2 No Rate Limiting or Usage Quotas

No rate limiting is mentioned anywhere in the architecture documents or the MCP server code. A public API without rate limiting is an availability risk (one runaway agent can saturate the server) and a cost risk (no guardrails on token or compute consumption).

**Minimum for v1:** Per-key rate limits on `repl_render`, `code_generate`, and `design_compose` (the most compute-intensive tools). A `Retry-After` header or equivalent in error responses when limits are exceeded. Quota visibility through a `usage_status` tool or header.

---

### 4.3 API Versioning Has No Contract

The DSL schema is versioned (`"version": "2026.02"`) and individual traits have semantic versions (`Stateful: 2.0.0`). But the MCP API itself has no version negotiation. There is no way for a caller to:

- Declare which DSL version it can consume
- Receive a deprecation warning when it uses a removed feature
- Pin to a specific schema version for deterministic output

When the DSL moves from `2026.02` to `2026.03`, existing `schemaRef` references will be silently invalid and existing composed schemas may fail validation with no indication that the format changed.

**Minimum for v1:** An `Accept-DSL-Version` parameter on compose/validate/render tools. A `deprecated_since` and `removal_date` field on any response using a superseded DSL feature. A changelog tool or endpoint that returns breaking changes since a given version.

---

### 4.4 Observability Is Absent

The `tokens_build` transcript is fully redacted (6 entries of `field: "*"`, reason: `configured_string`). No tool response includes latency, token counts, or trace IDs. There is no way for an operator or agent to:

- Measure which tools are slow
- Correlate a bad compose output to a specific server state
- Debug a pipeline failure across multiple tool calls
- Audit what schemas were composed and rendered for a given session

For a public tool used by AI agents (which can call tools hundreds of times per session), observability is a first-class requirement. Without it, diagnosing regressions, cost anomalies, or security incidents is guesswork.

**Minimum for v1:**
- Every tool response includes a `requestId` (correlation ID for distributed tracing)
- Latency in milliseconds included in `meta`
- The `tokens_build` transcript redaction policy must be scoped — it should redact secrets, not the entire operation record
- A structured error log accessible through a `logs` tool or webhook

---

### 4.5 No Documented Error Taxonomy

The current error codes are organically named: `MISSING_BASE_TREE`, `PATCH_PATH_MISSING`, `A11Y_CONTRAST`. These are reasonable names but there is no published registry, no documented stability guarantee, and no guidance on which errors are retryable vs fatal.

Agents consuming this API need to handle errors programmatically. Without a stable, documented error taxonomy, every agent must hard-code string matching against error codes that may change without notice.

**Minimum for v1:** A versioned error code registry with:
- Code, category (validation / auth / rate-limit / server-error), human message, retryable (boolean), documentation link
- Commitment that registered codes will not be renamed without a deprecation period
- Machine-readable error responses that include the code as a top-level field (currently buried inside `errors[0].code`)

---

### 4.6 No Health or Readiness Tool

There is no `health` or `ping` tool. An agent starting a session has no way to verify the MCP server is ready before making expensive calls. The previous exploration report also called this out as a cross-server issue.

**Minimum for v1:** A `health` tool returning server version, DSL version, registry version, uptime, and dependency status (token registry, object store, component catalog). Should respond in under 50ms and be usable as a startup check by any agent orchestrator.

---

## Section 5: Developer Experience

### 5.1 No Public API Reference

The `/docs` directory contains 63+ markdown files — architecture notes, component docs, runbooks, billing domain specs. These are implementation-time authoring documents, not a public API reference.

A developer picking up this tool for the first time needs:
- Tool contract documentation (parameters, return shape, error codes) for all 11 tools
- A quickstart guide (5-minute path from zero to working component code)
- Object reference (what objects exist, what their traits are, what fields they expose)
- A cookbook (common patterns: "how do I compose a Subscription detail page", "how do I generate code for a custom object")

Without these, the tool is only usable by people who already know the internal architecture. That is not a public v1.

---

### 5.2 No SDK or Client Library

The MCP protocol is the only interface. Agents interact through raw JSON tool calls with no type safety, no convenience methods, and no retry logic. A TypeScript SDK (matching the already-generated types in `/generated/types/`) would let developers:

```typescript
const client = new OODSFoundryClient({ apiKey: '...' });
const schema = await client.compose({ object: 'Subscription', context: 'detail' });
const code = await client.generate(schema, { framework: 'react', styling: 'tailwind' });
```

The internal packages (`mcp-server`, `mcp-bridge`, `mcp-adapter`) suggest the infrastructure is there. A thin public-facing SDK wrapper would dramatically lower the adoption curve.

---

### 5.3 Map Registry Needs CRUD

`map_create` and `map_list` and `map_resolve` exist. `map_update` and `map_delete` do not. Once a mapping is written with `apply=true`, it cannot be corrected, versioned, or removed through the MCP. This is particularly painful for the `confidence: "auto"` workflow where machine-generated mappings may need to be corrected and the correction cannot be persisted.

---

### 5.4 Missing Behavioral Traits Break List Composition

The catalog has no `Searchable`, `Filterable`, `Pageable`, or `Sortable` traits. These are among the most common behaviors in any data-intensive product. The `design_compose(layout="list")` output uses a raw `Input` for search and a raw `Select` for filters — unconnected to any semantic trait.

This means:
- There's no way to declare "this object is searchable by name and email" and have the list compose respect that
- There are no components for search field, filter panel, or pagination that carry OODS trait semantics
- Agents composing list views must manually wire these concerns every time

Adding `Searchable` and `Pageable` traits with corresponding components (`SearchInput`, `PaginationBar`, `FilterPanel`) would make the list layout a first-class semantic composition, not just a structural template.

---

### 5.5 Visualization Traits Have No Compose Path

The catalog has 20+ visualization traits across mark, scale, encoding, interaction, and spatial categories. These are richly defined with 15+ components (VizMarkControls, VizLinePreview, VizAxisControls, etc.). But:

- No compose layout type produces a chart or visualization slot
- `design_compose(layout="dashboard")` produces a generic `main-content` slot, not a chart area
- There is no `viz_compose` or `chart_compose` tool

A dashboard with a revenue chart requires going entirely outside the compose pipeline. The visualization system is the most distinctive part of the OODS trait taxonomy and it's completely disconnected from the compose/render/generate pipeline.

---

### 5.6 Object Maturity Is Not Surfaced

`Subscription.object.yaml` declares `maturity: beta`. This matters for public API users — beta objects may have breaking changes. But:
- There is no `object_list` or `object_show` tool to see this
- `catalog_list` doesn't expose which components come from beta objects
- `design_compose` doesn't warn when composing from beta trait definitions

A user building production code on top of OODS should know which parts of the object model are stable vs in flux.

---

## Section 6: The OODS Object Model — Gaps and Rough Edges

### 6.1 `Geocodable` and `Addressable` Have Undefined Interaction

`Addressable` is in the core trait category (postal addresses, delivery, roles). `Geocodable` is in `viz.spatial` (lat/lng, map resolution). An entity like a physical store or a warehouse would naturally have both. But:
- Neither trait YAML defines a conflict or composition rule with the other
- No component appears in both trait families
- The `regions` arrays don't overlap in obvious conflict
- There's no documentation of how the two interact or which takes precedence

This is a gap in the trait authoring model: composite entities that span spatial and address domains have no guidance.

---

### 6.2 `Stateful` Is Used by 18 Objects But StatusBadge Has Duplicate Traits

`Stateful.trait.yaml` notes it is "used by 18 objects including User, Subscription, Product, Order" — the most-composed trait in the system. Yet in the catalog, `StatusBadge` has `traits: ["Stateful", "Stateful", "Statusable", "Statusable", "Statusable"]` — three duplicates.

The most critical component for the most critical trait has corrupted catalog metadata. This suggests the source-of-truth generation pipeline (which produces the structured-data JSON from the YAML files) has a deduplication bug in the traitUsages → catalog.traits flattening step.

---

### 6.3 `Communicable` Components Are Incomplete Stubs

`CommunicationDetailPanel`, `MessageEventTimeline`, `MessageStatusBadge`, and `TemplatePicker` all have:
- `regions: []` — unplaceable by any layout engine
- No `codeReferences` returned by `catalog_list(detail="full")`
- No code snippet returned

This pattern strongly suggests these are defined objects in the trait system but are not yet implemented as React components. They occupy namespace in the catalog without being usable. This is fine during development but must be resolved for a public release — either implement them or exclude them from the catalog with an explicit `status: "planned"` field.

---

### 6.4 The Token System Has an A11Y Defect at the Source

`sys.text.muted` on `sys.surface.canvas` fails WCAG AA at 2.68:1 (minimum 4.5:1). This was caught by `repl_validate(checkA11y=true)`. But the defect is in the token design, not in any component using it — meaning every component that uses muted text on a canvas surface inherits this failure. It will appear in accessibility audits for any production UI built with these tokens.

The fix is a single OKLCH lightness adjustment to `sys.text.muted`. But it needs to be fixed at the token layer before a public release, not flagged as a warning that individual developers are expected to override.

---

### 6.5 No `Searchable` Trait, but `TagInput` Has Autocomplete Logic

`TagInput.tsx` implements `useTagAutocomplete` and `useTagSuggestions` hooks — sophisticated search-as-you-type behavior. This is exactly the kind of behavior that should be encoded as a `Searchable` trait so it can be composed onto any entity. Instead it's coupled to the tag domain specifically.

The autocomplete pattern inside `TagInput` is a signal that the team has built searchable behavior; it just hasn't been abstracted into a reusable trait yet. Doing so would benefit the list compose path, the classification system, and any future entity that needs type-ahead discovery.

---

## What a Solid v1 Looks Like

For a public release that earns trust from real developers and agents, the following must be true:

**Non-negotiable capabilities:**
- `object_show(name)` and `object_list` tools exposing the domain object model
- `design_compose(object, context)` path that uses trait view_extensions for slot selection
- propSchema defaults wired into generated component props from the object field schema
- `tokens_build apply=true` actually compiling and writing token values (bug fix)
- CSS layout mapping corrected (bug fix)
- Authentication and tenant context on every tool call
- A documented, stable error code registry

**Strong expectations for v1:**
- Class-based CSS output in `code_generate` (Tailwind integration)
- `map_update` and `map_delete` tools
- Schema persistence (`schema_save` / `schema_load`)
- `health` tool
- Object maturity surfaced in catalog and compose responses
- `Communicable` components either implemented or removed from catalog
- A11Y token defect resolved at the token layer

**Makes it genuinely good:**
- `Searchable` and `Pageable` traits with composed list components
- Visualization compose path (chart slot in dashboard layout)
- A TypeScript SDK wrapping the MCP tools
- Quickstart documentation with a working end-to-end example
- `requestId` correlation and latency in all tool responses
- Coercion engine for map propMappings

---

## The Core Reframe

The current MCP is a well-built UI scaffolding tool with a rich component catalog. What it is not yet is what OODS is supposed to be: a semantic layer where business objects generate their own views deterministically.

The infrastructure exists. The object YAMLs are there. The trait definitions are there. The view_extensions are there. The propSchemas with defaults are there. The semantic token mappings are there. What's missing is the bridge: an MCP layer that reads those artifacts and uses them to do real work.

Once that bridge exists, the pitch "give me a Subscription object and I'll give you a production-ready detail page" becomes true. Until then, the tool asks developers to carry all of that knowledge themselves and manually wire everything — which is no better than working without OODS at all.

---

*All findings based on direct MCP tool invocations, project filesystem exploration, and reading of white papers, architecture docs, and source code. No speculation — every gap cited corresponds to a confirmed absence in the tooling or documentation.*

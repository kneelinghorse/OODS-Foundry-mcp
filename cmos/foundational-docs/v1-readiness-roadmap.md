# OODS Foundry MCP — v1 Readiness Roadmap
**Created:** 2026-03-04
**Source:** Dual multi-agent audit (GPT-5 Codex + Claude Sonnet 4.6) + planning sessions
**Companion reports:**
- `cmos/reports/oods-foundry-mcp-real-world-readiness-2026-03-04.md` (GPT-5 Codex)
- `cmos/reports/oods-foundry-mcp-v1-readiness-2026-03-04.md` (Claude Sonnet 4.6)

---

## Core Diagnosis

Both audit agents independently converged on the same finding:

> The MCP is a well-built UI scaffolding tool. What it isn't yet is what OODS promises: a **semantic layer where business objects generate their own views deterministically**.

The object system (12 domain objects with traits, view_extensions, propSchemas, semantic token mappings) exists in YAML files but was unreachable from any MCP tool. The infrastructure existed — what was missing was the bridge.

---

## Tier Overview

| Tier | Theme | Sprints | Status |
|------|-------|---------|--------|
| **Tier 0** | The Bridge — Object system in MCP | 61, 62, 63 | Sprint 61-62 complete, Sprint 63 active |
| **Tier 1** | Production Essentials | TBD (~2 sprints) | Not started |
| **Tier 2** | Platform Hardening | TBD (~2 sprints) | Not started |
| **Tier 3** | Differentiation | TBD (~2-3 sprints) | Not started |

---

## Tier 0 — The Bridge (COMPLETE / IN PROGRESS)

**Goal:** Transform the scaffolding tool into the semantic composition engine OODS promises. A user should be able to call `design_compose(object="Subscription", context="detail")` and get back a fully trait-driven layout with domain components, wired props, and typed code.

### Sprint 61 — Object System Foundation (COMPLETED)
| Mission | Deliverable |
|---------|-------------|
| s61-m01 | YAML loader infrastructure (js-yaml, object-loader, trait-loader, caching) |
| s61-m02 | Trait composition engine (schema merge, view_extension priority resolution, token override) |
| s61-m03 | `object_list` MCP tool (name, domain, version, maturity, traits, filters) |
| s61-m04 | `object_show` MCP tool (full definition with composed view_extensions) |
| s61-m05 | Output JSON schemas + generated TypeScript types |
| s61-m06 | Contract tests + green baseline |

### Sprint 62 — Object-Aware Compose (COMPLETED)
| Mission | Deliverable |
|---------|-------------|
| s62-m01 | Extend compose input/output schema (`object` + `context` params) |
| s62-m02 | View extension collector (SlotPlan[] from composed traits) |
| s62-m03 | View extension to slot placement (priority-based, position heuristics) |
| s62-m04 | Object semantic token injection (tokenOverrides in UiSchema) |
| s62-m05 | Tab/section label generation (trait categories, not "Tab 1/2/3") |
| s62-m06 | Intent + object hybrid mode (auto-detection, fuzzy matching) |
| s62-m07 | Contract tests + green baseline |

### Sprint 63 — Data Binding in Codegen (ACTIVE)
| Mission | Deliverable |
|---------|-------------|
| s63-m01 | Field schema bridge to codegen (objectSchema + bindings in UiSchema) |
| s63-m02 | React emitter: typed Props interface from object field schema |
| s63-m03 | Vue emitter: typed defineProps from object field schema |
| s63-m04 | Event handler stubs (context-appropriate: form/list/detail) |
| s63-m05 | E2E pipeline tests (compose -> validate -> render -> codegen) |
| s63-m06 | Contract tests + green baseline |

**Tier 0 acceptance test:** `design_compose(object="Subscription", context="detail")` produces React/Vue code with `StatusBadge`, `CycleProgressCard`, typed `SubscriptionDetailProps`, and `handleEdit`/`handleDelete` stubs.

---

## Tier 1 — Production Essentials

**Goal:** Make the tool usable for real iterative work by teams. Schemas persist, code is production-ready with class-based styling, and the pipeline collapses from 7 calls to 2-3.

### 1.1 Schema Persistence
- `schema_save(name, schemaRef)` — save a composed schema by name with metadata (object, context, version, author, createdAt, tags)
- `schema_load(name)` — load a saved schema, return schemaRef for reuse in validate/render/codegen
- `schema_list` — list saved schemas with filters (object, context, tags)
- `schema_delete(name)` — remove a saved schema
- Schema diffing between versions (optional, high value)
- **Storage:** Filesystem-backed JSON store minimum; SQLite if we need query performance
- **Source:** Both audits flagged this as must-have. Without it, agents can't build iteratively across sessions and teams can't share canonical layouts.

### 1.2 Class-Based Styling Output (Tailwind)
- Add `styling: "tailwind"` option to `code_generate`
- Emit Tailwind utility classes derived from `tokens.tailwind.json` (artifact from `tokens_build`)
- Connect the existing `tw-variants` package to the codegen pipeline
- Interactive states (hover, focus, disabled, invalid) require class-based styling — inline styles can't express them
- **Source:** Sonnet 4.6 Section 2.2 — "Inline styles block interactivity"

### 1.3 Pipeline Orchestration
- Single orchestration command/mode: compose -> validate -> render -> codegen in one call
- Configurable flags: skip validation, skip render, select framework, select styling
- Reduce the 7-call ceremony to 2-3 calls for the common case
- **Source:** Both audits — GPT-5 "End-to-End Orchestration", Sonnet 4.6 Section 3

### 1.4 Health / Readiness Tool
- `health` tool returning: server version, DSL version, registry version, uptime, dependency status (token registry, object store, component catalog)
- Response time target: <50ms
- Usable as a startup check by agent orchestrators
- **Source:** Sonnet 4.6 Section 4.6

### Tier 1 Estimated Scope
- ~10-12 missions across 2 sprints
- Schema persistence is the largest workstream (~4-5 missions)
- Tailwind codegen + orchestration + health could share a sprint

---

## Tier 2 — Platform Hardening

**Goal:** Make the tool robust, diagnosable, and maintainable. Errors are documented, outputs are traceable, and the mapping system is complete.

### 2.1 Error Taxonomy
- Versioned error code registry with: code, category (validation/auth/rate-limit/server-error), human message, retryable (boolean)
- Commitment: registered codes won't be renamed without deprecation period
- Machine-readable error responses with code as top-level field
- **Source:** Sonnet 4.6 Section 4.5

### 2.2 Observability
- Every tool response includes `requestId` (correlation ID)
- Latency in milliseconds in `meta` block
- Scoped `tokens_build` transcript redaction (redact secrets, not entire operation)
- Structured error log accessible via tool or webhook
- **Source:** Sonnet 4.6 Section 4.4

### 2.3 Coercion Engine for Map Prop Mappings
- Currently `map_create` accepts `coercion` field but all coercions return `null`
- Implement at minimum: `enum` coercion (source value -> target value lookup) and `boolean_to_string`
- `coercion` field becomes a typed discriminated union, not nullable placeholder
- Critical for external design system migration use case
- **Source:** Sonnet 4.6 Section 1.4

### 2.4 Map CRUD Completion
- Add `map_update` and `map_delete` tools
- Currently only `map_create`, `map_list`, `map_resolve` exist
- Without update/delete, machine-generated mappings (`confidence: "auto"`) cannot be corrected
- **Source:** Sonnet 4.6 Section 5.3

### 2.5 Communicable Component Resolution
- 4 Communicable components (CommunicationDetailPanel, MessageEventTimeline, MessageStatusBadge, TemplatePicker) have `regions: []` and no code references
- Either implement them as real components or exclude from catalog with `status: "planned"`
- **Source:** Sonnet 4.6 Section 6.3

### 2.6 Stable / Repeatable Outputs
- Stable ordering of nodes and props in generated schemas
- Seeded selection (or disabled randomness) for deterministic output
- Registry and token source version metadata in all outputs
- **Source:** GPT-5 "Stable, Repeatable Outputs"

### Tier 2 Estimated Scope
- ~10-14 missions across 2 sprints
- Error taxonomy + observability could share a sprint
- Coercion + map CRUD + Communicable resolution in another

---

## Tier 3 — Differentiation

**Goal:** Features that make OODS genuinely distinctive and publicly compelling. New trait categories, visualization support, SDK, documentation, and platform security.

### 3.1 Behavioral Traits (Searchable, Pageable, Filterable, Sortable)
- No behavioral traits exist for common data-intensive patterns
- `design_compose(layout="list")` uses raw Input/Select — no semantic trait connection
- Adding Searchable and Pageable traits with components (SearchInput, PaginationBar, FilterPanel) makes list layout a first-class semantic composition
- **Source:** Sonnet 4.6 Section 5.4

### 3.2 Visualization Compose Path
- 20+ viz traits and 15+ viz components exist but have no compose path
- `design_compose(layout="dashboard")` produces generic main-content, not chart areas
- Need either a `viz_compose` tool or chart slot integration in dashboard layout
- **Source:** Sonnet 4.6 Section 5.5

### 3.3 TypeScript SDK
- Thin public-facing SDK wrapping MCP tools with typed methods
- Internal packages (mcp-server, mcp-bridge, mcp-adapter) provide the infrastructure
- Example: `client.compose({ object: 'Subscription', context: 'detail' })`
- **Source:** Sonnet 4.6 Section 5.2

### 3.4 Public API Reference + Quickstart
- Tool contract docs (params, return shape, error codes) for all tools
- 5-minute quickstart guide (zero to working component code)
- Object reference (what objects exist, traits, fields)
- Cookbook (common patterns)
- **Source:** Sonnet 4.6 Section 5.1

### 3.5 Authentication + Rate Limiting
- API key authentication passed as header or MCP init param
- Tenant ID derivation from API key
- Per-key rate limits on compute-intensive tools (render, codegen, compose)
- `Retry-After` header on rate limit errors
- **Source:** Sonnet 4.6 Sections 4.1, 4.2

### 3.6 API Versioning Contract
- `Accept-DSL-Version` parameter on compose/validate/render tools
- `deprecated_since` and `removal_date` on superseded DSL features
- Changelog tool/endpoint for breaking changes since a given version
- **Source:** Sonnet 4.6 Section 4.3

### 3.7 Object Maturity Surfacing
- `object_list` and `object_show` expose maturity (draft/beta/stable) — done in Tier 0
- `catalog_list` should indicate which components come from beta objects
- `design_compose` should warn when composing from beta trait definitions
- **Source:** Sonnet 4.6 Section 5.6

### Tier 3 Estimated Scope
- ~15-20 missions across 2-3 sprints
- Behavioral traits + viz compose could be one sprint
- SDK + docs + auth could be one sprint
- API versioning + maturity could fold into either

---

## Items Already Fixed (Sprint 60)

These were P0/P1 bugs from the same dual audit, fixed before roadmap planning:

| Issue | Sprint 60 Mission | Status |
|-------|-------------------|--------|
| tokens_build apply writes stub instead of compiled tokens | s60-m01 | Fixed |
| CSS align maps to wrong axis on row layouts | s60-m02 | Fixed |
| brand_apply patch schema rejects arrays | s60-m03 | Fixed |
| schemaRef not usable as implicit baseTree in patch mode | s60-m04 | Fixed |
| design_compose intent binding ignores catalog tags/traits | s60-m05 | Fixed |
| componentOverrides don't materialize in schema tree | s60-m06 | Fixed |
| A11Y sys.text.muted fails WCAG AA contrast | s60-m07 | Fixed |
| StatusBadge duplicate traits, empty regions, unscoped stats | s60-m08 | Fixed |

---

## Decision Log

| Decision | Date | Context |
|----------|------|---------|
| Tier 0 is the critical path — all other tiers depend on object system existing | 2026-03-04 | Both audits agree: without object system, tool is generic scaffolding |
| Objects loaded from YAML at startup, cached in-memory singleton | 2026-03-04 | Same pattern as component catalog JSON loading |
| Trait composition: higher priority wins same-region conflicts | 2026-03-04 | Deterministic, matches view_extension YAML conventions |
| Schema persistence is filesystem-backed minimum (Tier 1) | 2026-03-04 | SQLite if query performance needed later |
| Tailwind codegen via existing tw-variants + tokens.tailwind.json | 2026-03-04 | Infrastructure exists, just needs pipeline connection |
| Auth/rate limiting deferred to Tier 3 | 2026-03-04 | Appropriate for local dev tool; required for public API |

---

## How to Use This Document

1. **Before each planning session:** Read the relevant tier section to understand scope
2. **When creating a sprint:** Pull missions from the tier items, break into actionable units
3. **After completing a tier:** Update status in this doc and assess if tier scope changed
4. **When audited again:** Compare findings against remaining tiers to validate/reprioritize

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
| **Tier 0** | The Bridge — Object system in MCP | 61, 62, 63 | COMPLETE |
| **Tier 1** | Production Essentials | 64, 65 | COMPLETE |
| **Tier 2** | Platform Hardening | 66, 67 | COMPLETE |
| **Tier 3** | Differentiation | 68, 69, 70 | PLANNED |

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

### Sprint 63 — Data Binding in Codegen (COMPLETED)
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

## Tier 1 — Production Essentials (COMPLETE)

**Goal:** Make the tool usable for real iterative work by teams. Schemas persist, code is production-ready with class-based styling, and the pipeline collapses from 7 calls to 1.

### Sprint 64 — Schema Persistence & Health (COMPLETED)
| Mission | Deliverable |
|---------|-------------|
| s64-m01 | Schema store infrastructure (filesystem-backed, _index.json fast path) |
| s64-m02 | `schema_save` MCP tool |
| s64-m03 | `schema_load` MCP tool (registers schemaRef in cache) |
| s64-m04 | `schema_list` + `schema_delete` MCP tools |
| s64-m05 | Schema persistence integration tests |
| s64-m06 | `health` MCP tool (ok/degraded, <50ms, subsystem enumeration) |
| s64-m07 | Contract tests + green baseline |

### Sprint 65 — Tailwind Codegen + Pipeline Orchestration (COMPLETED)
| Mission | Deliverable |
|---------|-------------|
| s65-m01 | Tailwind token mapping module (tailwind-mapper.ts, CVA variants) |
| s65-m02 | `styling: "tailwind"` option for React + Vue emitters |
| s65-m03 | `pipeline` MCP tool (compose→validate→render→codegen→save in 1 call) |
| s65-m04 | Tailwind + pipeline tests |
| s65-m05 | Contract tests + green baseline |

**Tier 1 acceptance test (PASSING):** `pipeline(object="Subscription", context="detail", framework="react", styling="tailwind", save="name")` → `schema_load(name)` → `code_generate(schemaRef, framework="vue", styling="tailwind")` → `health()` shows savedCount=1. All steps verified 2026-03-05.

---

## Tier 2 — Platform Hardening (COMPLETE)

**Goal:** Make the tool robust, diagnosable, and maintainable. Errors are documented, outputs are traceable, and the mapping system is complete.

### Sprint 66 — Error Taxonomy + Observability (COMPLETED)
| Mission | Deliverable |
|---------|-------------|
| s66-m01 | Error code registry (OODS-V/N/C/S format, createError helper) |
| s66-m02 | Structured error responses in all tools (machine-readable codes) |
| s66-m03 | Request correlation + latency tracking (meta.requestId, meta.latency) |
| s66-m04 | Stable deterministic output ordering (props, nodes, catalog sort) |
| s66-m05 | Error + observability tests + green baseline |

**Key decisions:**
- Error codes: `OODS-{category}{number}` — V (validation), N (not found), C (conflict), S (server error)
- Observability via middleware wrapper pattern (auto-inject requestId + latency tracking)
- No Math.random() in output-affecting code paths; version metadata in compose/codegen meta

### Sprint 67 — Coercion Engine + Map CRUD + Catalog Completion (COMPLETED)
| Mission | Deliverable |
|---------|-------------|
| s67-m01 | Coercion engine (enum, boolean_to_string, template, identity types) |
| s67-m02 | `map_update` + `map_delete` MCP tools |
| s67-m03 | Communicable component resolution (implement or mark planned) |
| s67-m04 | Coercion + map + catalog tests + green baseline |

**Key decisions:**
- CoercionDef is a discriminated union on `type` field; existing null coercions → identity
- Communicable components either get regions/code refs or `status: "planned"` with compose guard
- ComponentStatus type added; catalog_list supports status filter; compose guards exclude planned

### Tier 2 Scope: 9 missions across 2 sprints — all delivered. Test count: 1145.

---

## Tier 3 — Differentiation

**Goal:** Features that make OODS genuinely distinctive and publicly compelling. New trait categories, visualization support, SDK, documentation, and API versioning.

### Sprint 68 — Behavioral Traits + Maturity Surfacing (PLANNED)

*Items: 3.1 Behavioral Traits + 3.7 Object Maturity*

| Mission | Deliverable |
|---------|-------------|
| s68-m01 | Searchable + Filterable trait definitions (YAMLs, view_extensions, propSchemas) |
| s68-m02 | Pageable + Sortable trait definitions |
| s68-m03 | Behavioral components (SearchInput, PaginationBar, FilterPanel) + renderers |
| s68-m04 | List layout behavioral trait integration in design_compose |
| s68-m05 | Object maturity surfacing (object_show field, compose beta warning, catalog_list indicator) |
| s68-m06 | Behavioral traits + maturity tests + green baseline |

**Key context:**
- Only 1 behavioral trait exists (Taggable) — Searchable/Pageable/Filterable/Sortable are net-new
- object_list already has maturity filtering; object_show does not expose maturity
- **Sources:** Sonnet 4.6 Sections 5.4, 5.6

### Sprint 69 — Visualization Compose Path (PLANNED)

*Item: 3.2 Viz Compose — dedicated `viz_compose` MCP tool*

| Mission | Deliverable |
|---------|-------------|
| s69-m01 | viz_compose tool scaffold + full registration (handler, schemas, registry, policy, bridge, adapter, error codes) |
| s69-m02 | Viz trait resolution engine (mark→chart type, encoding→axis, layout→composition, scale, interaction) |
| s69-m03 | Viz component wiring + slot placement (18 existing components paired and slotted) |
| s69-m04 | Viz codegen support (React/Vue emitters handle viz component props and imports) |
| s69-m05 | Viz compose tests + green baseline |

**Key context:**
- 15 viz traits + 18 viz components already exist but are orphaned from compose
- New tool registration requires ~13 file touchpoints; middleware/observability is automatic
- Decision: dedicated `viz_compose` tool chosen over dashboard layout extension
- **Source:** Sonnet 4.6 Section 5.5

### Sprint 70 — SDK + Docs + API Versioning (PLANNED)

*Items: 3.3 SDK + 3.4 Docs + 3.6 Versioning*

| Mission | Deliverable |
|---------|-------------|
| s70-m01 | @oods/sdk package scaffold (OodsClient, transport layer, type exports) |
| s70-m02 | SDK core workflow methods (compose, vizCompose, pipeline, codegen, schema CRUD, objects, catalog, health) |
| s70-m03 | Auto-generated per-tool API reference from schemas (pnpm run docs:api) |
| s70-m04 | Cookbook — 5 recipes (list→detail, dashboard+charts, multi-brand, full pipeline, schema iteration) |
| s70-m05 | Accept-DSL-Version param + deprecated_since fields + health changelog |
| s70-m06 | SDK + docs + versioning tests + green baseline |

**Key context:**
- Comprehensive docs already exist (807-line Tool-Specs.md) — per-tool pages are auto-generated expansion
- No @oods/sdk package yet; thin wrapper over MCP tools
- Data versioning exists in structuredData.fetch; dslVersion is new infrastructure for tool evolution
- **Sources:** Sonnet 4.6 Sections 5.1, 5.2, 4.3

### Deferred: Authentication + Rate Limiting (3.5)
- Role-based policy.json (designer/maintainer), bridge token, per-tool rate limits already cover local/team use
- Per-user API keys and tenant derivation deferred to post-v1 when public API is needed
- **Source:** Sonnet 4.6 Sections 4.1, 4.2

### Tier 3 Scope: 17 missions across 3 sprints

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
| Schema store is filesystem-backed JSON (not SQLite) | 2026-03-05 | _index.json fast path for listing; no DB dependency needed |
| Pipeline tool collapses 7-call ceremony to 1 call (not 2-3) | 2026-03-05 | Single call covers compose→validate→render→codegen→save |
| Tier 0 + Tier 1 complete — 12 objects, 94 components, 37 traits, full CRUD + Tailwind | 2026-03-05 | Acceptance test passing end-to-end |
| Tier 2 complete — error taxonomy, observability, coercion engine, map CRUD, catalog status | 2026-03-05 | 9/9 missions, 1145 tests |
| Tier 3 planned as 3 sprints (68-70): behavioral traits, viz_compose tool, SDK+docs+versioning | 2026-03-05 | Auth deferred past v1 |
| viz_compose as dedicated tool (not dashboard layout extension) | 2026-03-05 | 15 traits + 18 components orphaned; dedicated tool is cleaner composition boundary |

---

## How to Use This Document

1. **Before each planning session:** Read the relevant tier section to understand scope
2. **When creating a sprint:** Pull missions from the tier items, break into actionable units
3. **After completing a tier:** Update status in this doc and assess if tier scope changed
4. **When audited again:** Compare findings against remaining tiers to validate/reprioritize

# OODS Quick-Compose MCP Stack – Technical Architecture

## 0) Executive Summary

The OODS Quick-Compose stack solves the specific gap between “blank-slate” generative UI tooling and the enterprise design constraints enforced by Foundry’s design system. Teams need to spin up marketing/blog microsites or rapid feature previews without leaving governance rails; existing tools either impose foreign component libraries (Relume) or leak unvetted code (Locofy). Quick-Compose fuses the in-house MCP server, protocol manifests, and research-derived context bundles so every generated layout is constrained to approved components, tokens, and workflows.

The solution routes every build through three planes: (1) Research Capture generates machine-readable context bundles from inspirational sites; (2) MCP Orchestration consumes bundles, fetches component/tokens from the Component MCP server, and produces JSON layout intents; (3) The Runtime Protocol Bridge hydrates manifests into React, enforcing semantic, accessibility, and governance contracts at render time. Workflow + Agent protocols describe the entire mission (collect context → call MCP → preview → approve), ensuring diffable governance.

Benefits include deterministic compliance (components/tokens only sourced via MCP), accelerated small-site production (no manual redlining), reusable research assets, and a provable audit trail linking inspiration references → manifests → generated UI. The architecture also keeps humans “in the loop”: designers curate bundles, and runtime hooks surface any policy violations before release.

---

## 1) Goals / Non-Goals

### Goals
- Make every “quick” UI build (marketing/blog/micro-app) operate strictly within the OODS component/tokens canon.
- Provide a reusable research pipeline that captures inspiration sites as context bundles + assets for MCP consumption.
- Expose MCP services, components, and orchestration agents through formal protocol manifests (Agent/UI/Semantic/Workflow).
- Deliver runtime enforcement via the protocol bridge so rendered React components validate context, governance, and a11y contracts.
- Maintain an auditable workflow (plan → approve → execute) for all MCP-driven missions.

### Non-Goals
- Replacing enterprise-grade Figma workflows for net-new product surfaces (Quick-Compose only targets lightweight builds).
- Serving as an “AI art” generator (focus is structural UI assembly, not pure imagery).
- Building a multi-tenant SaaS; this is an internal stack wired to Foundry’s repos and governance.
- Owning CDN/hosting; generated sites still deploy through existing Storybook/Pages pipelines.

---

## 2) System Overview

```
┌────────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│ Research Input │        │ Context Bundle Store │        │ Component MCP      │
│ (URLs, CSS,    │ 1.ing. │ (JSON + assets in    │ 2.fetch │ Server (@oods/mcp) │
│ screenshots)   │ ─────► │ artifacts/research)  │ ──────► │ tokens/components  │
└────────────────┘        └──────────────────────┘        └────────────────────┘
        │                           │                                   │
        │3.publish                  │4.load bundle                      │
        ▼                           ▼                                   │
┌────────────────────────────┐  ┌─────────────────────┐      5.register manifests
│ MCP Workflow Orchestrator  │◄─┤ Quick-Compose Agent │◄────┐(UI/Semantic/Agent)
│ (workflow protocol)        │   │ (Agent protocol)    │     │
└────────────┬───────────────┘   └─────────▲──────────┘     ▼
             │7.layout JSON             6.call MCP APIs ┌───────────────┐
             ▼                                         │Runtime Bridge │
      ┌───────────────┐                                │+ React App    │
      │ Artifact/WIP  │ 8.review/approve               └───────────────┘
      │ (Plan→Apply)  │──────────────►Human Reviewer           │
      └───────────────┘                                        │9.render with
                                                               │useProtocol()
                                                               ▼
                                                        Deployed Experience
```

Control Plane: Research capture, context bundle authoring, and workflow definitions live in Git (docs/research, missions). MCP services are configured via the Agent/Workflow protocols and exposed through the local bridge (`http://127.0.0.1:4466`). Plan→approve flows run through the mission harness to keep changes auditable.

Data Plane: At runtime, the Quick-Compose agent loads a bundle, queries the MCP Component server for tokens/components, produces a layout tree, and hands structured JSON to a renderer. The runtime bridge injects Semantic/UI manifests so each component validates its usage and styling before rendering.

---

## 3) Core Components

### Research Capture Pipeline

**Purpose:** Curate inspiration sites into reusable, machine-readable context bundles with asset references.

**Responsibilities:**
- Crawl/snapshot public sites (URLs, screenshots, HTML/CSS hashes).
- Extract IA, personas, component mappings, and token translations (e.g., CSS vars from Linear/Vercel/Notion).
- Publish Markdown summaries + JSON bundles under `docs/research` and `/artifacts/research/<id>/`.

**Technology/Implementation:** Shell + curl + Python utilities for scraping, stored as Markdown/JSON artifacts; leverages local filesystem.

### Component MCP Server (`@oods/mcp-server`)

**Purpose:** Expose authoritative component manifests, tokens, diagnostics, and tooling via the Model Context Protocol.

**Responsibilities:**
- Serve `GET /components` / `GET /components/{name}` / `GET /tokens` from the design system source of truth.
- Enforce plan→approve gating on write operations.
- Provide tooling endpoints (`diag.snapshot`, `tokens.build`, etc.) for orchestration.

**Technology/Implementation:** Node/TypeScript MCP server built from `packages/mcp-server`, exposed through `@oods/mcp-bridge` HTTP proxy (port 4466).

### Quick-Compose Agent

**Purpose:** Orchestrate the generation of quick builds by combining context bundles with MCP component data.

**Responsibilities:**
- Load bundle metadata (personas, IA, required components).
- Query MCP for approved components/tokens, inject into LLM prompts.
- Emit JSON layout trees + asset references into artifacts for review.

**Technology/Implementation:** Agent Protocol v1.1.1 manifest + CLI harness; LLM orchestrator (provider-agnostic).

### Protocol Stack (UI, Semantic, Workflow, Agent)

**Purpose:** Provide manifests, validators, diffing, and generators for components, semantics, workflows, and agents.

**Responsibilities:**
- Define component props/states/a11y (`ui_component_protocol_v_1_1_1.js`).
- Calculate intent/criticality/vectors + protocol bindings (`Semantic Protocol — v3.2.0.js`).
- Describe plan→approve workflows with SLA + DAG validation (`workflow_protocol_v_1_1_1.js`).
- Register agents with capabilities and communication contracts (`agent_protocol_v_1_1_1.js`).

**Technology/Implementation:** Pure JS modules (zero deps) inside `src/system_protocols`.

### Runtime Protocol Bridge

**Purpose:** Hydrate protocol manifests into runtime React components for governance/a11y enforcement.

**Responsibilities:**
- Maintain registry mapping component names → protocol URNs.
- Provide `ProtocolViewProvider` + `useProtocol` hook injecting context, governance, semantics.
- Warn or block renders when context violates supported use cases.

**Technology/Implementation:** React context + hooks (`src/system_protocols/runtime-protocol-bridge.js`).

---

## 4) Primary Interface/API

### Component MCP Bridge (`http://127.0.0.1:4466`)

#### Operation: `GET /tools`
**Input:** None.  
**Output:** Array of tool metadata (name, description, apply flag).  
**Behavior:** Lists available MCP tools; fails with 5xx if server not built.

#### Operation: `POST /run`
**Input:** `{ "tool": "diag.snapshot", "input": { "apply": false }, "context_bundle": "research/linear-core.json" }`.  
**Output:** JSON body referencing artifact URIs.  
**Behavior:** Executes a tool (read-only unless `apply:true` + approval header). On error returns structured failure message referencing MCP policy.

```json
{
  "tool": "diag.snapshot",
  "input": {
    "apply": false,
    "bundle": "research/linear-core.json"
  }
}
```

### Quick-Compose Mission Spec (`Site.QuickCompose`)

#### Operation: `mission.start`
**Input:** Bundle ID, mission parameters (persona emphasis, target device).  
**Output:** Plan artifact + pending approval checkpoint.  
**Behavior:** Plans steps (load bundle → fetch MCP data → generate layout). Errors if bundle missing required assets.

#### Operation: `mission.execute`
**Input:** Approval token, plan hash.  
**Output:** Layout JSON + rendered preview references.  
**Behavior:** Runs orchestrator, writes artifacts, triggers runtime validation.

---

## 5) Internal Service APIs

### API Endpoint: `GET /components`
**Request:** Optional query params (`?type=hero`).  
**Response:** Array of component manifests (UI protocol shape + Semantic enrichment).  
**Purpose:** Provide the orchestrator/runtime with machine-readable component definitions.  
**Transport:** HTTP (MCP bridge proxy).

### API Endpoint: `GET /tokens`
**Request:** None.  
**Response:** Design tokens (color, spacing, typography) in JSON schema.  
**Purpose:** Ensure generated layouts only reference approved tokens; map external palettes (Linear/Vercel/Notion) to internal aliases.  
**Transport:** HTTP.

### API Endpoint: `POST /context/bundle/validate`
**Request:** `{ "bundleId": "research/vercel-ai.json" }`.  
**Response:** `{ "ok": true, "issues": [] }`.  
**Purpose:** Validate bundles against schema (personas, IA, component refs) before mission execution.  
**Transport:** In-process utility (Python/TS CLI); future HTTP microservice.

---

## 6) Data Model

### Entity: `ContextBundle`
- `id` (string) | unique bundle slug, e.g., `linear-core` | primary key  
- `source_url` (string) | canonical inspiration URL | required  
- `personas` (array) | list of `{id, role, job_to_be_done}` | ≥1 entry  
- `ia` (array) | ordered sections with component hints | required  
- `components` (array) | list of required component IDs (URNs) | matches MCP entries  
- `tokens` (object) | mapping from external CSS vars → OODS tokens | optional  
- `assets` (array) | references to `/artifacts/research/<id>/<file>` | optional but recommended  
- `prompt_stub` (object) | mission instructions snippet | required for automation

Relationships: references `ComponentManifest` via URNs; consumed by `MissionPlan`.  
Indexes: `id`, `components[*]`.

### Entity: `ComponentManifest` (UI protocol)
- `urn` (string) | `urn:proto:ui:hero.orchestrator@1.1.1` | primary key  
- `component.name` (string) | matches runtime component export | required  
- `data.props` (array) | prop definitions | validated  
- `behavior.states` (object) | state machine | required  
- `a11y.contract` (object) | ARIA role/label mapping | required for interactive components

Relationships: referenced by `SemanticManifest` (via `context.protocolBindings`), linked to React component at runtime.

### Entity: `MissionPlan`
- `mission_id` (string) | e.g., `Site.QuickCompose` | required  
- `bundle_id` (string) | FK to `ContextBundle.id`  
- `steps` (array) | workflow steps with statuses | workflow protocol shape  
- `artifacts` (array) | generated outputs with URIs | optional

Relationships: tracks approvals; used in audit logs.

---

## 7) Canonical Flows

### Flow: Capture Inspiration → Bundle
1. Researcher selects a site (e.g., Linear.app) and runs the capture script (curl/html snapshot).  
2. Script extracts CSS tokens, IA, personas, and stores screenshots under `/artifacts/research/linear-core`.  
3. Researcher fills `docs/research/quick-site-context-bundles.md` entry + JSON bundle.  
4. Bundle validator checks schema; if passing, mission backlog marks bundle “available”.  
*Errors:* Missing asset path → validator fails; researcher re-captures.

### Flow: Quick-Compose Mission
1. Designer triggers `Site.QuickCompose` with `bundle_id=linear-core`.  
2. Workflow agent loads bundle, queries MCP `/components` + `/tokens`.  
3. Orchestrator prompts LLM with bundle+component context; LLM emits layout JSON.  
4. System renders preview via runtime bridge, attaches to artifact, awaits approval.  
5. Reviewer approves; mission writes final assets to repo/deployment pipeline.  
*Errors:* MCP unreachable → mission aborts; plan flagged for retry. Component mismatch → runtime hook warns and blocks render.

### Flow: Runtime Validation
1. During render, each React component calls `useProtocol(componentName)`.  
2. Hook fetches manifest, ensures current `view/domain` context is supported.  
3. If governance or a11y requirements fail, component logs warning/prompts fallback UI.  
4. Metrics emitted to observability stack for governance compliance.

---

## 8) Performance, Caching & SLOs

### SLO Targets
- `bundle.validate.latency` ≤ 1s (p95)  
- `mcp.run.diag.snapshot` ≤ 120s (p95) even with full diagnostics  
- `render.protocol-hook` ≤ 5ms per component (p95) to avoid UI jank

### Caching Strategy
- **Layer:** Bundle cache (in-memory)  
  - **What:** Parsed JSON bundles.  
  - **TTL:** 10 minutes during mission execution.  
  - **Invalidation:** On bundle file change (watcher) or mission completion.
- **Layer:** MCP component cache  
  - **What:** `GET /components` responses.  
  - **TTL:** 5 minutes; invalidated when `tokens.build` runs or repo hash changes.

### Optimization Strategies
- Precompute Semantic vectors + protocol hashes during build to avoid runtime enrichment costs.
- Use streaming responses from MCP bridge to start rendering while remaining components load.

---

## 9) Security, Governance, Cost Controls

### Authentication (AuthN)
- Local developers authenticate via shell user; MCP bridge optionally enforces `BRIDGE_TOKEN`.
- Remote agents authenticate using signed headers (future state) or local trust boundary.

### Authorization (AuthZ)
- MCP tools split into read-only vs. write-gated; bridge enforces `X-Bridge-Approval`.
- Workflow protocol governs which roles may approve plan/apply steps.
- Runtime hook respects governance flags (e.g., PII handling) to gate usage.

### Quotas & Rate Limits
- MCP bridge rate-limits `POST /run` to protect MCP server (configurable, default 5 rps).
- LLM orchestrator enforces per-mission token caps to control API spend.

### Audit Trail
- Every mission writes transcripts + artifacts under `artifacts/current-state/<date>/`.
- Protocol manifests include hashes; diffs recorded in Git for change tracking.

### Cost Controls
- LLM usage logged per mission; alerts trigger if spend exceeds budget.
- Diagnostics track token build times to catch runaway jobs.

---

## 10) Observability

### Metrics

**System Metrics**
- `bundle.capture.count`: number of new bundles/week; measures research throughput.
- `mission.quick_compose.success_rate`: ratio of successful missions; signals stability.
- `runtime.protocol_violation`: count of runtime warnings/errors; ensures governance.

**Infrastructure Metrics**
- `mcp.bridge.latency_ms`: response time for `/run`; monitors MCP health.
- `llm.token_usage`: tokens per mission; feeds cost controls.

### Tracing
- `mission.start` → `bundle.load` → `mcp.fetch` → `llm.generate` → `runtime.render`.
- `runtime.render` → `useProtocol` → `component.validate` spans highlight slow components.

### Events
- `bundle.created`: triggered when new context bundle committed; payload includes id, assets.
- `mission.approved`: when reviewer approves Quick-Compose output; payload includes plan hash.
- `protocol.diff`: fired when manifest signature changes; includes URN and change summary.

---

## 11) Deployment & Release

### Deployment Architecture
- MCP server + bridge run stateless Node processes; restart safe.
- Bundles/assets live in Git; deployments piggyback on existing CI (Storybook Pages, Chromatic).
- Runtime protocol bridge bundles with the React app (Storybook + production builds).
- Environments: local (developer machines with `pnpm --filter @oods/mcp-bridge run dev`), staging (CI runner), prod (GitHub Pages + consuming apps).

Release process:
1. Update bundles/protocol manifests via PR (includes artifacts, tests).
2. Run MCP smoke harness + Storybook runtime tests.
3. Merge to main; CI redeploys MCP packages + Storybook.
4. Mission backlog references new bundles; Quick-Compose ready for use.

### Release Process
**[Outline deployment workflow:]**
- [How are changes rolled out?]
- [What safeguards exist?]
- [How are rollbacks handled?]

### Disaster Recovery
**[Describe backup and recovery strategy]**

---

## 12) Testing & Benchmarking

### Unit/Integration Tests
**[What test categories exist?]**
- [Test type 1]: [what it validates]
- [Test type 2]: [what it validates]

### Quality Benchmarks
**[How is quality measured?]**
- [Metric/test suite]
- [Success criteria]

### Resilience Testing
**[How do you test failure scenarios?]**
- [Chaos test 1]
- [Graceful degradation test]

### Performance/Load Testing
**[How is performance validated?]**
- [Load scenario]
- [Metrics tracked]

---

## 13) Reference Interfaces

**[Provide example schemas for key interfaces]**

### Interface Name

```json
{
  "field": "type",
  "description": "Purpose of this field",
  "constraints": "Validation rules"
}
```

**[Note: Use minimal examples showing structure only]**

---

## 14) Roadmap

**[Outline implementation phases]**

### MVP (Sprint 1-2)
**[What is the minimum viable system?]**

**Deliverables:**
- [Core feature 1]
- [Core feature 2]

### Sprint 3-4
**[What comes next?]**

**Deliverables:**
- [Enhancement 1]
- [Enhancement 2]

### Future Phases
**[What is deferred but planned?]**
- [Advanced feature 1]
- [Advanced feature 2]

---

## 15) Open Questions

**[List unresolved technical decisions:]**

- [Question 1]?
- [Question 2]?
- [Question 3]?

**[For each question, optionally note:]**
- Why this needs resolution
- Potential options being considered
- Who decides or what research is needed

# Agent UX Opus 4.6 Reproduction (2026-03-04)

**Source report:** `cmos/reports/Opus-4.6-findings.md`
**Adapter path:** `packages/mcp-adapter/index.js`
**Repro harness:** `packages/mcp-adapter/opus-4.6-repro.js`
**Guard tests:** `packages/mcp-adapter/test-s57-m01.js`

**Environment**
- Date run: 2026-03-04
- Transport: MCP stdio adapter (`packages/mcp-adapter/index.js`)
- Toolset: `MCP_TOOLSET=all`
- Fixtures: `packages/mcp-server/test/fixtures/ui/basic-mix.ui-schema.json`

**Quick Repro**
```bash
node packages/mcp-adapter/opus-4.6-repro.js
```

**Guard Tests (High/Critical)**
```bash
node packages/mcp-adapter/test-s57-m01.js
```

Current guard test results:
- `design.compose` schemaRef: FAIL (no schemaRef)
- `catalog.list` default summary/pagination: FAIL (119,798 chars)
- `code.generate` React triple-brace: PASS (not reproduced)
- `repl.render` docs mention apply/preview-only: FAIL (docs missing apply/preview-only note)

**Reproduction Matrix**

| Issue | Severity | Repro (tool + input) | Observed Output | Status | Owner |
| --- | --- | --- | --- | --- | --- |
| Schema passthrough overhead / missing `schemaRef` | CRITICAL | `design_compose` with tabbed detail intent; then `repl_validate` with `{ mode: "full", schemaRef: "compose-abc123" }` | `design_compose` response size: 7,174 chars. `repl_validate` rejects `schemaRef` with: `Input validation failed: missing required field: 'schema'; ... unknown field 'schemaRef'` | Reproduced | s57-m02 |
| `catalog.list` unfiltered overflow | HIGH | `catalog_list` with `{}` | Response size: 119,798 chars for 93 components (adapter output). | Reproduced | s57-m03 |
| `repl.render` HTML contract mismatch (apply gating not documented) | HIGH | `repl_render` with `{ mode: "full", schema: basic-mix, output: { format: "document" } }` and same with `apply: true` | `apply` omitted: `html` missing. `apply: true`: `html` present, response size 88,375 chars. Docs do not mention apply/preview-only. | Partially reproduced (behavior is apply-gated, docs unclear) | s57-m04 |
| React codegen triple-brace style bug | HIGH | `code_generate` with `{ framework: "react", options: { styling: "inline" }, schema: basic-mix }` | Output does **not** include `style={{{` (0 occurrences). | Not reproduced on current head | s57-m05 |
| `catalog.list` trait filter `Searchable` returns 0 | LOW | `catalog_list` with `{ trait: "Searchable" }` | Response `components: []`, `totalCount: 0` while `traitCount: 37`. | Reproduced | Backlog |
| `design.compose` per-slot intent not parsed | MEDIUM | `design_compose` with tab labels: Overview, Billing, Activity, Settings | Tabs rendered as a single `Tabs` node with tab panels containing only slot stacks (`component: "Stack"`, `meta.intent: "slot:tab-X"`). No domain-specific components in tab bodies. | Reproduced | Backlog |
| `repl.validate` patch mode error | MEDIUM | `repl_validate` with `{ mode: "patch", baseTree: basic-mix, patch: [{ nodeId: "basic-text", path: "component", value: "ArchiveEvent" }] }` | Returns `status: ok` with normalized tree; no error observed. | Not reproduced | Backlog |
| `brand.apply` preview verbosity | MEDIUM | `brand_apply` with `apply: false` and small delta | Response size: 65,748 chars for single typography delta. | Reproduced | Backlog |
| `tokens.build` preview empty | LOW | `tokens_build` with `{ theme: "dark", apply: false }` | `artifacts: []` with transcript/bundle paths only. | Reproduced | Backlog |

**Detailed Observations**

**SchemaRef gap (Critical)**
- `design_compose` returned a full UiSchema (`~7.1 KB`) with no `schemaRef` or reuse handle.
- `repl_validate` rejects `schemaRef` today. Error: `Input validation failed: missing required field: 'schema'; ... unknown field 'schemaRef'`.
- Acceptance criteria (s57-m02): `design.compose` returns `schemaRef`; `repl.validate`, `repl.render`, and `code.generate` accept it with actionable error handling for missing/expired refs.

**catalog.list overflow (High)**
- Unfiltered response: 119,798 characters, 93 components.
- Acceptance criteria (s57-m03): summary mode + pagination defaults for unfiltered calls, explicit opt-in for full detail.

**repl.render contract mismatch (High)**
- `apply` omitted: output is metadata-only; no `html` field.
- `apply: true`: `html` present and large payload.
- Tool-Specs do not mention that `apply` gates HTML output or describe a preview-only mode.
- Acceptance criteria (s57-m04): documentation and runtime semantics aligned; explicit description of metadata-only vs HTML output, and HTML returned when requested.

**React codegen triple braces (High)**
- Not reproduced on 2026-03-04. Guard test added to prevent regression.
- Acceptance criteria (s57-m05): no `style={{{` in React output in adapter path and snapshot tests.

**Artifacts**
- Repro harness: `packages/mcp-adapter/opus-4.6-repro.js`
- Guard tests: `packages/mcp-adapter/test-s57-m01.js`

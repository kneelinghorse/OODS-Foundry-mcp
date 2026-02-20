# Context Loading Strategy

Use a tiered load to keep agents fast and focused. The goal is to reach working context in under 3k tokens, then rely on retrieval for details.

## Tiered Loading Pattern
1. Tier 1 (always): `agents.md` (repo charter and MCP workflow).
2. Tier 2 (task): one runbook from `docs/runbooks/`. If none exists, use the single most relevant short doc.
3. Tier 3 (depth): 2-4 deep docs tied to the task (use the table below).
4. Tier 4 (retrieval): on-demand search for file paths, APIs, and edge cases.

## Token Budget Reference
| Tier | Typical tokens | Notes |
| --- | --- | --- |
| Tier 1 | ~500 | Always load. Keeps mission workflow consistent. |
| Tier 2 | ~200 | One runbook only. If you need two, swap the task. |
| Tier 3 | ~2000 | 2-4 docs max. Prefer shorter docs first. |
| Tier 4 | 300-1500 | Only pull what you need, when you need it. |

## Task-to-Docs Map (Tier 3)
| Task | Runbook (Tier 2) | Deep docs (Tier 3) |
| --- | --- | --- |
| Add a trait | `docs/runbooks/add-a-trait.md` | `docs/authoring-traits.md`, `docs/specs/regions.md`, `docs/compositor-readme.md` |
| Add an object | `docs/runbooks/add-an-object.md` | `docs/authoring-objects.md`, `docs/dependency-resolution.md`, `docs/cli-reference.md` |
| Add a chart | `docs/runbooks/add-a-chart.md` | `docs/viz/getting-started.md`, `docs/viz/normalized-viz-spec.md`, `docs/viz/anti-patterns.md`, `docs/contexts/chart-context-guide.md` |
| Change tokens safely | `docs/runbooks/change-tokens-safely.md` | `docs/tokens/4-layer-overview.md`, `docs/tokens/governance.md`, `docs/themes/dark-guidelines.md` |
| Update status map | `docs/runbooks/update-status-map.md` | `docs/domains/billing/README.md`, `docs/tokens/4-layer-overview.md`, `docs/themes/dark-guidelines.md` |
| Connect MCP client | `docs/mcp/Connections.md` (no runbook) | `docs/mcp/Tool-Specs.md`, `packages/mcp-server/src/tools/registry.json`, `docs/mcp/Structured-Data-Refresh.md` |
| Refresh structured data | `docs/mcp/Structured-Data-Refresh.md` (no runbook) | `cmos/scripts/refresh_structured_data.py`, `artifacts/structured-data/manifest.json`, `cmos/planning/structured-data-delta-*.md` |
| Viz performance check | `docs/viz/performance-guide.md` (no runbook) | `docs/viz/performance-optimization.md`, `docs/viz/renderer-selection-guide.md`, `docs/viz/layout-adapter-guide.md` |

## Example Context Manifests
- `docs/agent-operations/context-manifests/add-a-trait.md`
- `docs/agent-operations/context-manifests/add-an-object.md`
- `docs/agent-operations/context-manifests/add-a-chart.md`
- `docs/agent-operations/context-manifests/change-tokens-safely.md`
- `docs/agent-operations/context-manifests/update-status-map.md`
- `docs/agent-operations/context-manifests/mcp-connection.md`
- `docs/agent-operations/context-manifests/structured-data-refresh.md`
- `docs/agent-operations/context-manifests/viz-performance.md`

## Retrieval Triggers (Tier 4)
Use retrieval when you hit one of these:
- A file path is unclear or missing from Tier 3 docs.
- A command fails and you need exact flags or config format.
- Tests are failing and you need a specific fixture or helper reference.

## Practical Rules
- Stop after Tier 3 unless you are blocked.
- If you exceed 4 deep docs, convert the extras into retrieval queries.
- Keep a running list of paths you already loaded to avoid repeats.
- If Tier 2 has no runbook, consider adding one to `docs/runbooks/`.

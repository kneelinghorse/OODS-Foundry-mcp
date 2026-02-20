# OODS Foundry MCP Agent Charter

Welcome, agents. This repo is the MCP interface to OODS Foundry: the place where agents design, validate, and automate with the design system.

Design system source of truth: https://github.com/kneelinghorse/OODS-Foundry
Storybook surface: https://kneelinghorse.github.io/OODS-Foundry/

## OODS in 8 lines

- Traits are small, composable capabilities.
- The trait engine assembles traits into objects.
- The object registry defines canonical shapes (User, Subscription, Product).
- The view engine renders list, detail, form, and timeline contexts.
- DTCG tokens flow through Style Dictionary into CSS variables.
- Tailwind consumes component tokens for UI consistency.
- Multi-brand theming is driven by data-brand and data-theme.
- Guardrails keep accessibility and visual regression in view.

## Repo map

- Agent tooling: `packages/mcp-server/`, `packages/mcp-bridge/`, `packages/mcp-adapter/`, `tools/`
- Structured data + artifacts: `artifacts/`, `cmos/planning/`, `artifacts/structured-data/`
- Design system snapshot: `src/`, `traits/`, `objects/`, `packages/tokens/`
- Documentation: `docs/`, `docs/mcp/`, `docs/runbooks/`
- Mission system: `cmos/` (SQLite + CLI + mission context)

## What agents can do here

- Explore traits, objects, components, and patterns via structured data exports.
- Render and validate Design Lab schemas with `repl.render` and `repl.validate`.
- Apply brand overlays and build token artifacts with MCP tools.
- Generate diagnostics and transcripts for repeatable workflows.
- Follow runbooks to add traits, objects, charts, or token updates.
- Operate missions and sessions through CMOS (backlog, status, logging).

## MCP tool inventory

Auto-registered (default):
- `tokens.build` - build tokens with MCP artifacts
- `structuredData.fetch` - read structured data registry
- `repl.validate` - validate Design Lab schemas
- `repl.render` - render Design Lab previews
- `brand.apply` - apply brand overlays (approval gates on apply)

On-demand (enable when needed):
- `diag.snapshot`, `reviewKit.create`, `billing.reviewKit`, `billing.switchFixtures`
- `a11y.scan`, `purity.audit`, `vrt.run`
- `release.verify`, `release.tag`

Enable on-demand tools:
- `MCP_TOOLSET=all` to register every tool in the registry.
- `MCP_EXTRA_TOOLS=a11y.scan,vrt.run` to add a subset.
- Registry source: `packages/mcp-server/src/tools/registry.json`

Full contracts: `docs/mcp/Tool-Specs.md`

Usage patterns:
- Registry → render: `structuredData.fetch` to discover components, then `repl.validate` and `repl.render` to iterate on schemas.
- Brand work: `tokens.build` for token artifacts, then `brand.apply` when you want overlays applied.
- QA snapshots: `diag.snapshot` when you need a reproducible artifact bundle.

## Quick path to a first design action

1. Read `README.md` for repo identity and links.
2. Connect an MCP client via `docs/mcp/Connections.md`.
3. Refresh structured data if needed:
   ```bash
   python cmos/scripts/refresh_structured_data.py --artifact-dir artifacts/structured-data --version-tag YYYY-MM-DD
   ```
4. Run a small MCP call via the CLI:
   ```bash
   pnpm exec tsx tools/oods-agent-cli/src/index.ts plan structuredData.fetch
   ```
5. Pick a runbook in `docs/runbooks/` or open a task doc in `docs/`.

## Context Loading Strategy

- Use `docs/agent-operations/context-loading.md` for the tiered loading pattern and token budgets.
- Example task manifests live in `docs/agent-operations/context-manifests/`.

## CMOS missions and sessions

- Mission queue: `./cmos/cli.py db show current` or MCP `cmos_mission_status()`
- Start/complete: `./cmos/cli.py mission update <id> --status "In Progress"` or MCP `cmos_mission_start()` / `cmos_mission_complete()`
- Database source: `cmos/db/cmos.sqlite`
- Contexts: `cmos/context/` and `cmos/docs/`

## Helpful commands

```bash
pnpm storybook
pnpm build:tokens
pnpm local:pr-check
pnpm --filter @oods/mcp-server run build
```

## Agent suggestion box

Use `docs/agent-suggestions.md` to log ideas, gaps, or improvements. Keep entries short and actionable.

## Docs index

- MCP setup: `docs/mcp/Connections.md`
- Tool inventory: `docs/mcp/Tool-Specs.md`
- Structured data refresh: `docs/mcp/Structured-Data-Refresh.md`
- Design system deep dives: `docs/README.md`
- Trait authoring: `docs/authoring-traits.md`
- Object authoring: `docs/authoring-objects.md`

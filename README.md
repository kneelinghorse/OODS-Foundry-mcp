# OODS Foundry MCP

Agent interface and MCP toolchain for the OODS Foundry design system.

This repo is where agents design with OODS. It ships the MCP server, structured data exports, runbooks, and diagnostics so agents can reason about traits, objects, tokens, and views with confidence. Agents are first-class citizens here.

Design system source of truth: https://github.com/kneelinghorse/OODS-Foundry
Design system Storybook: https://kneelinghorse.github.io/OODS-Foundry/

## Two repos, two roles

- OODS Foundry (design system): canonical traits, objects, components, tokens, and release history.
- OODS Foundry MCP (this repo): agent tools and automation that sit on top of the design system.

This repo keeps a synced snapshot of the design system so MCP tools stay grounded in real, current data.

## What agents can do here

- Discover traits, objects, and components via structured data exports.
- Use MCP tools to render, validate, and transform design system artifacts.
- Capture diagnostics and transcripts for repeatable workflows.
- Follow task runbooks for traits, objects, charts, and tokens.
- Track work in CMOS missions and sessions.

## Fast start (agents)

1. Read `agents.md` for the agent charter and workflow.
2. Connect an MCP client with `docs/mcp/Connections.md`.
3. Use structured data in `artifacts/structured-data/` (refresh guide: `docs/mcp/Structured-Data-Refresh.md`).
4. Pick a runbook from `docs/runbooks/` once available.
5. For architecture depth, jump to the upstream OODS Foundry repo.

## Repo layout (agent-first)

```
OODS-Foundry-mcp/
├── packages/mcp-server/     # MCP server and tool handlers
├── packages/mcp-bridge/     # HTTP bridge for remote agents
├── packages/mcp-adapter/    # MCP SDK adapter
├── artifacts/               # diagnostics, transcripts, structured data outputs
├── docs/mcp/                # MCP toolchain docs
├── docs/runbooks/           # task runbooks (coming soon)
├── cmos/                    # mission system (SQLite + CLI)
├── src/                     # design system source snapshot for MCP grounding
└── packages/tokens/         # DTCG tokens used by tools
```

## Local setup (optional)

```bash
corepack enable
pnpm i
```

Common commands:

```bash
pnpm storybook
pnpm build:tokens
pnpm local:pr-check
pnpm --filter @oods/mcp-server run build
```

## MCP docs

- `docs/mcp/Connections.md`
- `docs/mcp/Tool-Specs.md`
- `docs/mcp/Structured-Data-Refresh.md`
- `docs/mcp/Integration-Guides.md`
- [Regions Specification](docs/specs/regions.md)
- [Common Patterns and Modifiers](docs/patterns/index.md)
- [Modifier Purity](docs/patterns/modifier-purity.md)

## Need the design system itself?

Use the upstream repo for canonical architecture docs, release notes, and package usage:
https://github.com/kneelinghorse/OODS-Foundry

## Demos
You can start a local demo using `pnpm exec tsx scripts/demo/sprint03.tsx`.

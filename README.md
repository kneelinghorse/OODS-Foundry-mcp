# OODS Foundry MCP

Production MCP server + toolchain for the OODS Foundry design system.

This repo turns the OODS design system into an agent-usable surface: a semantic catalog you can query, schemas you can validate, and governed token theming you can apply.

Design system source of truth: https://github.com/kneelinghorse/OODS-Foundry
Design system Storybook: https://kneelinghorse.github.io/OODS-Foundry/

## Three capability pillars

### 1) Discover (semantic registry)

- Query structured exports of the design system (components, traits, objects, tokens).
- Use `structuredData.fetch` for raw datasets and `catalog.list` for an agent-friendly component catalog.
- Current inventory (structured-data version `2026-02-24`): **73 components**, **35 traits**, **12 objects**.

### 2) Validate (schema checking)

- Validate and normalize Design Lab UiSchema payloads (and patches) deterministically.
- Use `repl.validate` to check trees and `repl.render` to apply patches + emit preview metadata.

### 3) Theme (governed token overlays)

- Preview or apply brand token deltas safely.
- Use `brand.apply` for governed overlays and `tokens.build` for token artifact generation.

## Two repos, two roles

- **OODS Foundry (design system):** canonical traits, objects, components, tokens, release history.
- **OODS Foundry MCP (this repo):** MCP server + agent tooling built on top of the design system snapshot.

## Quick start

1. Read `agents.md` for the agent charter and workflow.
2. Install dependencies:
   ```bash
   corepack enable
   pnpm i
   ```
3. Build the MCP server:
   ```bash
   pnpm --filter @oods/mcp-server run build
   ```
4. Make a first MCP call (local CLI runner):
   ```bash
   pnpm exec tsx tools/oods-agent-cli/src/index.ts plan catalog.list '{}'
   ```
5. Connect an MCP client (Cursor/Claude/Desktop/etc) using `docs/mcp/Connections.md`.

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

## Common commands

```bash
pnpm storybook
pnpm build:tokens
pnpm refresh:data
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

## Demo (optional)

Start a local demo:
```bash
pnpm exec tsx scripts/demo/sprint03.tsx
```

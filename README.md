# OODS Foundry MCP

Production MCP server + toolchain for the OODS Foundry design system.

This repo turns the OODS design system into an agent-usable surface: a semantic catalog you can query, schemas you can validate and compose, governed token theming you can apply, and code you can generate — all through MCP tools.

Design system source of truth: https://github.com/kneelinghorse/OODS-Foundry
Design system Storybook: https://kneelinghorse.github.io/OODS-Foundry/

## Five capability pillars

### 1) Discover (semantic registry)

- Query structured exports of the design system (components, traits, objects, tokens).
- Use `structuredData.fetch` for raw datasets and `catalog.list` for an agent-friendly component catalog.
- Current inventory (structured-data version `2026-02-24`): **73 components**, **35 traits**, **12 objects**.

### 2) Validate (schema checking + accessibility)

- Validate and normalize Design Lab UiSchema payloads (and patches) deterministically.
- Use `repl.validate` to check trees and `repl.render` to apply patches + emit preview metadata.
- Enable `checkA11y: true` to run 18 WCAG contrast rules alongside structural validation.
- Use `a11y.scan` for a standalone accessibility contrast report against DTCG design tokens.

### 3) Theme (governed token overlays)

- Preview or apply brand token deltas safely.
- Use `brand.apply` for governed overlays and `tokens.build` for token artifact generation.

### 4) Compose (intent-driven UI generation)

- Describe what you want in natural language and get a valid UiSchema back.
- Use `design.compose` with layout templates (dashboard, form, detail, list) and a deterministic component selection engine with 13 intent mappings.
- Auto-validates generated schemas via `repl.validate`.

### 5) Export (code generation + mapping)

- Generate framework-specific code from validated schemas.
- Use `code.generate` for React/TSX, Vue SFC, or standalone HTML output.
- Use `map.create`, `map.list`, and `map.resolve` to map external design system components (Material UI, Ant Design, etc.) to OODS traits with prop translations and coercion strategies.

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

## MCP tool surface (20 tools)

**Auto-registered (11 tools)** — available by default:

| Tool | Purpose |
|------|---------|
| `tokens.build` | Build token artifacts |
| `structuredData.fetch` | Read structured data registry (with versioned access) |
| `repl.validate` | Validate UiSchema trees (with optional WCAG a11y checks) |
| `repl.render` | Render UiSchema to HTML (document or fragment mode) |
| `brand.apply` | Apply governed brand token overlays |
| `catalog.list` | List component catalog entries |
| `code.generate` | Generate React/Vue/HTML from validated schemas |
| `design.compose` | Generate UiSchema from natural-language intent |
| `map.create` | Create external component-to-trait mappings |
| `map.list` | List component-to-trait mappings |
| `map.resolve` | Resolve an external component to OODS traits |

**On-demand (9 tools)** — enable with `MCP_TOOLSET=all` or `MCP_EXTRA_TOOLS=...`:

| Tool | Purpose |
|------|---------|
| `a11y.scan` | Standalone WCAG contrast scan against design tokens |
| `diag.snapshot` | Diagnostics artifact bundle |
| `reviewKit.create` | Design review kit bundles |
| `purity.audit` | Token purity audit |
| `vrt.run` | Visual regression tests |
| `billing.reviewKit` | Billing provider comparison kit |
| `billing.switchFixtures` | Switch billing provider fixtures |
| `release.verify` | Package reproducibility verification (maintainer only) |
| `release.tag` | Git tag creation (maintainer only) |

Full contracts: `docs/mcp/Tool-Specs.md`

## Repo layout (agent-first)

```
OODS-Foundry-mcp/
├── packages/mcp-server/     # MCP server and tool handlers
├── packages/mcp-bridge/     # HTTP bridge for remote agents
├── packages/mcp-adapter/    # MCP SDK adapter
├── artifacts/               # diagnostics, transcripts, structured data outputs
├── docs/mcp/                # MCP toolchain docs
├── docs/runbooks/           # task runbooks
├── cmos/                    # mission system (SQLite + CLI)
├── src/                     # design system source snapshot for MCP grounding
└── packages/tokens/         # DTCG tokens used by tools
```

## Common commands

```bash
pnpm storybook               # Start Storybook dev server
pnpm build:tokens             # Build design tokens
pnpm refresh:data             # Refresh structured data exports
pnpm local:pr-check           # Full local PR check (lint + tests + validation)
pnpm --filter @oods/mcp-server run build   # Build MCP server
pnpm bridge:dev               # Start MCP bridge in dev mode
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

## License

[MIT](LICENSE)

# OODS Foundry MCP

Production MCP server + toolchain for the OODS Foundry design system.

This repo turns the OODS design system into an agent-usable surface: a semantic catalog you can query, schemas you can validate and compose, governed token theming you can apply, and code you can generate — all through MCP tools.

Design system source of truth: https://github.com/kneelinghorse/OODS-Foundry
Design system Storybook: https://kneelinghorse.github.io/OODS-Foundry/

## Five capability pillars

### 1) Discover (semantic registry)

- Query structured exports of the design system (components, traits, objects, tokens).
- Use `structuredData.fetch` for raw datasets and `catalog.list` for an agent-friendly component catalog.
- Current inventory (`structuredData.fetch`, version `2026-03-06`): **101 components**, **41 traits**, **12 objects**.

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
- Use `design.compose` for general UI, `viz.compose` for chart schemas, and `pipeline` when you want compose → validate → render → code generation in one call.
- `schemaRef` values returned by `design.compose`, `viz.compose`, `pipeline`, and `schema.load` expire after 30 minutes unless you persist them with `schema.save`.
- Auto-validates generated schemas via `repl.validate`.

### 5) Export + interoperate

- Generate framework-specific code from validated schemas.
- Use `code.generate` for React/TSX, Vue SFC, or standalone HTML output.
- Use the `map.*` tools (`create`, `list`, `resolve`, `update`, `delete`) to map external design system components (Material UI, Ant Design, etc.) to OODS traits with prop translations and coercion strategies.
- Use `schema.save`, `schema.load`, `schema.list`, and `schema.delete` to persist and reuse schema work across sessions.
- Use `object.list`, `object.show`, and `health` to inspect object definitions and live server readiness.

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

## Project-level defaults (`.oodsrc`)

Drop a `.oodsrc` JSON file in your project root to set default options for `pipeline`, `design.compose`, and `code.generate`. Explicit tool params always win; a missing or invalid `.oodsrc` is silently ignored.

```json
{ "framework": "vue", "styling": "tailwind", "typescript": false }
```

Full schema and field reference: `docs/mcp/Tool-Specs.md` → "Project-level defaults".

## Cross-tool semantics

- `schemaRef` TTL: refs returned by `design.compose`, `viz.compose`, `pipeline`, and `schema.load` last 30 minutes. Persist them with `schema.save` when the workflow spans sessions or multiple review loops.
- `apply`: write-capable tools default to dry-run/preview behavior. Set `apply: true` only when you want artifacts written or heavy outputs returned. For `repl.render`, HTML/fragments are returned only when `apply: true`.
- `compact`: `pipeline` defaults to compact render output and returns `tokenCssRef` instead of inlining token CSS. `repl.render` keeps full token CSS by default; opt into compact behavior with `output.compact: true`.
- Trait names: `catalog.list` and `map.*` use canonical structured-data trait names such as `Stateful` or `Priceable`. `object.list` accepts full or suffix-matched namespaced object traits such as `lifecycle/Stateful` or `Stateful`. `viz.compose` explicit traits use hyphenated viz IDs such as `mark-bar` and `encoding-position-x`.
- Override escape hatch: when `design.compose` returns a low-confidence selection or `reviewHint`, pin only that slot with `preferences.componentOverrides`, for example `{"object":"Subscription","context":"detail","preferences":{"componentOverrides":{"tab-0":"Card"}}}`.

## MCP tool surface (31 tools)

Registry source of truth: `packages/mcp-server/src/tools/registry.json`.

**Auto-registered (22 tools)** — available by default:

| Group | Tools |
|------|-------|
| Core design/runtime | `tokens.build`, `structuredData.fetch`, `repl.validate`, `repl.render`, `brand.apply`, `catalog.list`, `health` |
| Composition + generation | `design.compose`, `viz.compose`, `pipeline`, `code.generate` |
| Mapping + schema persistence | `map.create`, `map.list`, `map.resolve`, `map.update`, `map.delete`, `schema.save`, `schema.load`, `schema.list`, `schema.delete` |
| Registry inspection | `object.list`, `object.show` |

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

Full contracts: `docs/mcp/Tool-Specs.md` and `docs/api/README.md`

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

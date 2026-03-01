# Contributing to OODS Foundry MCP

Thanks for your interest in contributing. This guide covers the dev setup, workflow, and expectations.

## Prerequisites

- Node.js 20+
- pnpm 9.12+ (`corepack enable && corepack prepare pnpm@9.12.2 --activate`)
- Git

## Dev Setup

```bash
git clone https://github.com/kneelinghorse/OODS-Foundry-mcp.git
cd OODS-Foundry-mcp
pnpm install
```

### Build & Test

```bash
pnpm build                    # TypeScript compilation
pnpm test                     # Run all tests (vitest)
pnpm test:unit                # Unit tests only
pnpm test:integration         # Integration tests only
pnpm local:pr-check           # Full local PR check (lint + tests + validation)
```

### MCP Server

```bash
pnpm --filter @oods/mcp-server run build
pnpm bridge:dev               # Start the MCP bridge in dev mode
```

### Tokens

```bash
pnpm build:tokens             # Build design tokens
pnpm tokens-validate          # Full token validation pipeline
```

## Pull Request Process

1. Create a feature branch from `main`.
2. Make your changes with tests. Aim for zero regressions.
3. Run `pnpm local:pr-check` before pushing.
4. Open a PR against `main` with a clear description of what changed and why.
5. Ensure CI passes. A reviewer will be assigned automatically via CODEOWNERS.

## Code Style

- TypeScript throughout. Strict mode enabled.
- Use existing patterns — check neighboring files before inventing new ones.
- Tests use vitest. Place tests next to source or in `tests/`.
- Prefer small, focused commits over large monolithic ones.

## MCP Tool Contributions

If adding or modifying an MCP tool:

1. Define the input/output JSON schemas in `packages/mcp-server/src/tools/`.
2. Register the tool in `registry.json` and `policy.json`.
3. Add contract tests in `tests/integration/`.
4. Update `docs/mcp/Tool-Specs.md` with the tool's contract.

## Reporting Issues

Use GitHub Issues. Include:

- What you expected vs. what happened.
- Steps to reproduce.
- Node/pnpm versions and OS.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

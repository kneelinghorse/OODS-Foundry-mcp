# Sprint 64 Test Baseline (Schema Persistence + Health)

Date: 2026-03-05

## Commands

- `pnpm --filter @oods/mcp-server exec vitest run`
- `pnpm --filter @oods/mcp-server run build`
- `pnpm test`
- `node packages/mcp-adapter/smoke-test.js`

## Results

- Vitest files: `67 passed`
- Vitest tests: `1003 passed`
- Build: `passed`
- Full suite files: `358 passed`
- Full suite tests: `2952 passed`
- Adapter smoke test: `9 passed, 0 failed`

## Registry Sync Check

- Source: `packages/mcp-server/dist/tools/registry.json`
- Counts: `18 auto`, `9 on-demand`, `27 total`
- Required Sprint 64 tools present: `schema.save`, `schema.load`, `schema.list`, `schema.delete`, `health`

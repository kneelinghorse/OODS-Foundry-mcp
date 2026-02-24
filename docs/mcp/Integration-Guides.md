# MCP Integration Guides

Practical runbooks that tie the Design Lab shell, structured data exports, semantic protocol runtime, and the Agent CLI together.

## Daily loop (local)

1) Refresh registries so Design Lab and MCP tools see current data:
```bash
pnpm refresh:data
```
2) Build the MCP server once (or rely on sources):
```bash
pnpm --filter @oods/mcp-server build
```
3) Run tooling through the Agent CLI with transcripts:
```bash
pnpm exec tsx tools/oods-agent-cli/src/index.ts plan diag.snapshot
pnpm exec tsx tools/oods-agent-cli/src/index.ts apply tokens.build '{"brand":"A"}' --approve
```
4) Embed `DesignLabShell` (see `docs/mcp/Design-Lab-Shell.md`) in Storybook or local UIs to preview schemas against the renderer/validator.

## Design Lab + structured data

- The agent lane issues `structuredData.fetch` for components/tokens; keep `cmos/planning/oods-components.json` and `oods-tokens.json` fresh via the refresh script.
- Renderer/validator calls come from `packages/mcp-server/src/tools/repl.render.js` and `repl.validate.js`; ensure the server build exists if not using sources.
- Snapshots + diffs make it safe to iterate on schemas before wiring them into MCP tools or releases.

## Artifacts, transcripts, replay

- Every CLI call writes signed transcripts under `artifacts/current-state/YYYY-MM-DD/cli/<tool>/<timestamp>-<command>/` alongside `summary.json` and a bundle index.
- Use `replay <transcriptPath> [--approve]` to re-run plans or apply recorded payloads after signature and artifact-hash verification. Missing input artifacts block replays.
- Server-side artifacts stay under `artifacts/current-state/YYYY-MM-DD/<tool>/`; bundle indices cross-link server and CLI transcripts.

## Semantic protocol runtime

- Register protocol manifests with `createSemanticProtocol` and wire them into `runtime-protocol-bridge` when components need runtime context (`useProtocol`, `ProtocolViewProvider`).
- `createSemanticCatalog` can surface related URNs for design reviews or integration audits; pair it with Design Lab snapshots to flag intent/binding drifts.
- Run `pnpm vitest tests/system-protocols/semantic-protocol.test.ts` when changing the protocol engine or bindings to keep the enrichment and validation guarantees intact.

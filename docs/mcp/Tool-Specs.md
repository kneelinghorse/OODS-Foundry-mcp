# MCP Tool Specs (v1.0)

This document is the contract surface for the OODS Foundry MCP server: tool names, registration rules, and the expected input/output shapes (backed by the JSON schemas in `packages/mcp-server/src/schemas/`).

## Registration + enablement

Auto tools are registered by default. On-demand tools are only registered when enabled.

- Enable every on-demand tool: `MCP_TOOLSET=all`
- Enable a subset: `MCP_EXTRA_TOOLS=a11y.scan,vrt.run`

Registry source of truth: `packages/mcp-server/src/tools/registry.json` (copied to `dist/tools/registry.json` on build).

Removed in v1.0: `design.generate` (it was a stub and is no longer shipped).

## Transport

The MCP server speaks newline-delimited JSON over stdio.

Request:
```json
{ "id": "1", "tool": "catalog.list", "input": {} }
```

Response (success):
```json
{ "id": "1", "result": { "status": "ok" } }
```

Response (error):
```json
{ "id": "1", "error": { "code": "SCHEMA_INPUT", "message": "Input validation failed" } }
```

## Auto tool contracts

### `tokens.build` (auto)

- Input schema: `packages/mcp-server/src/schemas/tokens.build.input.json`
- Output schema: `packages/mcp-server/src/schemas/generic.output.json`
- Purpose: produce token artifacts (and always emit a transcript + bundle index).

Example input:
```json
{ "brand": "A", "theme": "dark", "apply": false }
```

Example output:
```json
{
  "artifacts": [],
  "transcriptPath": "artifacts/current-state/2026-02-24/tokens.build/transcript.json",
  "bundleIndexPath": "artifacts/current-state/2026-02-24/tokens.build/bundle.json"
}
```

Notes:
- `apply=true` writes token artifacts under the run directory; `apply=false` is preview-only.

### `structuredData.fetch` (auto)

- Input schema: `packages/mcp-server/src/schemas/structuredData.fetch.input.json`
- Output schema: `packages/mcp-server/src/schemas/structuredData.fetch.output.json`
- Purpose: read structured datasets (`components`, `tokens`, `manifest`) with stable ETag support.

Example input:
```json
{ "dataset": "components", "ifNoneMatch": "deadbeef", "includePayload": true }
```

Example output (payload omitted when ETag matches):
```json
{
  "dataset": "components",
  "version": "2026-02-24",
  "generatedAt": "2026-02-24T05:09:44Z",
  "etag": "60c44643e57a55566ebb216000b57f3617a3ee6ef2c410b9cc10f1d72185be42",
  "matched": true,
  "payloadIncluded": false,
  "path": "cmos/planning/oods-components.json",
  "manifestPath": "artifacts/structured-data/manifest.json",
  "sizeBytes": 348465,
  "schemaValidated": true,
  "meta": { "componentCount": 73, "traitCount": 35, "objectCount": 12, "domainCount": 1, "patternCount": 2 }
}
```

### `repl.validate` (auto)

- Input schema: `packages/mcp-server/src/schemas/repl.validate.input.json`
- Output schema: `packages/mcp-server/src/schemas/repl.validate.output.json`
- Purpose: validate UiSchema trees (and optionally apply + validate patches).

Example input (mode=`full`):
```json
{
  "mode": "full",
  "schema": {
    "version": "2026.02",
    "dsVersion": "2026-02-24",
    "theme": "dark",
    "screens": [
      {
        "id": "screen_home",
        "component": "Stack",
        "children": [{ "id": "title", "component": "Text", "props": { "content": "Hello" } }]
      }
    ]
  }
}
```

Example output:
```json
{
  "status": "ok",
  "mode": "full",
  "dslVersion": "2026.02",
  "registryVersion": "2026-02-24",
  "errors": [],
  "warnings": [],
  "meta": { "screenCount": 1, "nodeCount": 2 }
}
```

### `repl.render` (auto)

- Input schema: `packages/mcp-server/src/schemas/repl.render.input.json`
- Output schema: `packages/mcp-server/src/schemas/repl.render.output.json`
- Purpose: apply patches and emit preview metadata for UiSchema trees.

Example input (mode=`patch`, node-targeted patch):
```json
{
  "mode": "patch",
  "baseTree": {
    "version": "2026.02",
    "screens": [{ "id": "screen_home", "component": "Stack", "children": [{ "id": "title", "component": "Text" }] }]
  },
  "patch": [{ "nodeId": "title", "path": "component", "value": "ArchiveEvent" }]
}
```

Example output:
```json
{
  "status": "ok",
  "mode": "patch",
  "dslVersion": "2026.02",
  "registryVersion": "2026-02-24",
  "errors": [],
  "warnings": [],
  "appliedPatch": true,
  "preview": {
    "screens": ["screen_home"],
    "routes": [],
    "activeScreen": "screen_home",
    "summary": "Render ready for 1 screen"
  }
}
```

### `brand.apply` (auto)

- Input schema: `packages/mcp-server/src/schemas/brand.apply.input.json`
- Output schema: `packages/mcp-server/src/schemas/brand.apply.output.json`
- Purpose: preview or apply governed token overlays (alias merge or RFC 6902 patch).

Example input (alias strategy preview):
```json
{
  "brand": "A",
  "strategy": "alias",
  "apply": false,
  "delta": { "typography": { "body": { "fontSize": 14 } } }
}
```

Example output (preview-only):
```json
{
  "artifacts": [],
  "transcriptPath": "artifacts/current-state/2026-02-24/review-kit/brand.apply/2026-02-24T05-00-00-000Z/transcript.json",
  "bundleIndexPath": "artifacts/current-state/2026-02-24/review-kit/brand.apply/2026-02-24T05-00-00-000Z/bundle.json",
  "preview": { "summary": "Updated 1 token value for brand A.", "notes": ["base: 1 updated token"] }
}
```

Notes:
- `apply=true` writes snapshots/diagnostics into the run directory; `apply=false` is non-destructive.

### `catalog.list` (auto)

- Input schema: `packages/mcp-server/src/schemas/catalog.list.input.json`
- Output schema: `packages/mcp-server/src/schemas/catalog.list.output.json`
- Purpose: list component catalog entries derived from `artifacts/structured-data` exports.

Example input:
```json
{ "category": "core" }
```

Example output (truncated):
```json
{
  "components": [
    {
      "name": "Button",
      "displayName": "Button",
      "categories": ["core"],
      "tags": [],
      "contexts": ["form"],
      "regions": [],
      "traits": ["Clickable"],
      "propSchema": {},
      "slots": {}
    }
  ],
  "totalCount": 1,
  "generatedAt": "2026-02-24T05:09:44Z",
  "stats": { "componentCount": 73, "traitCount": 35 }
}
```

## On-demand tools

Enable on-demand tools via `MCP_TOOLSET=all` or `MCP_EXTRA_TOOLS=...`.

Most on-demand tools use:
- Input schema: `packages/mcp-server/src/schemas/generic.input.json`
- Output schema: `packages/mcp-server/src/schemas/generic.output.json`

On-demand tool list:
- `diag.snapshot` (generic input/output): emits a diagnostics JSON artifact bundle.
- `reviewKit.create` (generic input/output): create review-kit bundles.
- `a11y.scan` (generic input/output): accessibility scan bundle.
- `purity.audit` (generic input/output): audit bundle.
- `vrt.run` (generic input/output): visual regression bundle.
- `billing.reviewKit` (input `billing.reviewKit.input.json`, output `generic.output.json`): compare billing fixtures and optionally write artifacts.
- `billing.switchFixtures` (input `billing.switchFixtures.input.json`, output `generic.output.json`): switch billing fixtures and optionally write artifacts.
- `release.verify` (input `release.verify.input.json`, output `release.verify.output.json`): maintainer-only package verification.
- `release.tag` (input `release.tag.input.json`, output `release.tag.output.json`): maintainer-only tagging.

## UiSchema DSL (Design Lab)

The Design Lab UiSchema is defined by `packages/mcp-server/src/schemas/repl.ui.schema.json`.

Core shape:
- `version` (string, required): DSL version used by `repl.validate`/`repl.render`.
- `screens` (array, required): each entry is a UI element with `{ id, component, children?, props?, layout?, style?, bindings?, meta? }`.

Patch shape:
- `packages/mcp-server/src/schemas/repl.patch.json` supports:
  - RFC 6902 JSON patch ops (`[{ op, path, value? }, ...]`) where `path` is a JSON pointer
  - node-targeted ops (`{ nodeId, path, value?, op? }`) where `path` is a dotted or slash-separated property path relative to the node

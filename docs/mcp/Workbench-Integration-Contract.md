# Synthesis Workbench Bridge Integration Contract

This contract defines how Workbench should call the OODS MCP bridge for rendered previews and structured registry data.

## Endpoint

- Base URL: `http://127.0.0.1:${MCP_BRIDGE_PORT:-4466}`
- Method: `POST /run`
- Health probe: `GET /health`
- Tool discovery: `GET /tools`

## Auth Headers

- `Content-Type: application/json` (required for `POST /run`)
- `X-Bridge-Token: <token>` when `BRIDGE_TOKEN` is configured on the bridge process.
- `X-Bridge-Approval: granted` only when requesting `apply:true` on tools that require approval.
  - `repl_render` currently allows `apply:true` without mandatory approval token (`approval: optional`).

## Tool Names

Workbench should use underscore names returned by `GET /tools`:

- `repl_render` (internal MCP tool: `repl.render`)
- `structuredData_fetch` (internal MCP tool: `structuredData.fetch`)

Backward compatibility:

- Dot names are accepted (`repl.render`, `structuredData.fetch`) but underscore names are the canonical bridge contract.

## Request Shapes

`structuredData_fetch`:

```json
{
  "tool": "structuredData_fetch",
  "input": {
    "dataset": "components",
    "includePayload": false
  }
}
```

`repl_render` (apply mode):

```json
{
  "tool": "repl_render",
  "input": {
    "apply": true,
    "mode": "full",
    "schema": {
      "version": "2026.02",
      "theme": "light",
      "screens": [
        {
          "id": "audit-screen",
          "component": "AuditTimeline",
          "layout": { "type": "stack", "gapToken": "stack-default" },
          "children": [
            { "id": "archive-summary", "component": "ArchiveSummary" }
          ]
        }
      ]
    }
  }
}
```

## Response Shapes

Bridge wrapper response:

```json
{
  "ok": true,
  "tool": "repl_render",
  "mode": "apply",
  "result": {
    "status": "ok",
    "html": "<!DOCTYPE html>..."
  }
}
```

Notes:

- `result.html` is present only when `apply:true` and render validation succeeds.
- Dry-run (`apply:false` or omitted) returns the existing metadata shape without `result.html`.
- Validation failures return `status:"error"` and omit `result.html`.

## Verified cURL Calls

```bash
curl -s http://127.0.0.1:4466/run \
  -H 'Content-Type: application/json' \
  -d '{"tool":"structuredData_fetch","input":{"dataset":"components","includePayload":false}}'

curl -s http://127.0.0.1:4466/run \
  -H 'Content-Type: application/json' \
  -d '{"tool":"repl_render","input":{"apply":true,"mode":"full","schema":{"version":"2026.02","theme":"light","screens":[{"id":"audit-screen","component":"AuditTimeline","layout":{"type":"stack","gapToken":"stack-default"},"children":[{"id":"archive-summary","component":"ArchiveSummary"}]}]}}}'
```

Expected outcomes:

- `structuredData_fetch` returns `ok:true` and component catalog metadata.
- `repl_render` returns `ok:true`, `mode:"apply"`, and `result.html` containing a self-contained HTML5 document with inlined token/component CSS.

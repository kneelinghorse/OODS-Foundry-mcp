# OODS MCP Connections

Local developers can connect agent clients to OODS MCP tools via two transports: **stdio adapter** (recommended) or **HTTP bridge**. This guide covers both approaches with connection profiles for Claude Desktop, Cursor, and the OpenAI Responses/Agents API.

## Prerequisites

```bash
# Install dependencies
pnpm install

# Build the native MCP server (required for both transports)
pnpm --filter @oods/mcp-server run build
```

## Stdio Adapter (Recommended)

The stdio adapter (`packages/mcp-adapter/`) wraps the native MCP server with a spec-compliant MCP interface that communicates via stdin/stdout. No HTTP bridge, port, or token configuration required.

### Claude Desktop (stdio)

Copy the config from `configs/agents/claude-desktop.stdio-mcp.json` into your Claude Desktop settings:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "oods-foundry": {
      "command": "node",
      "args": ["/absolute/path/to/OODS-Foundry-mcp/packages/mcp-adapter/index.js"],
      "env": {
        "MCP_TOOLSET": "all",
        "MCP_ROLE": "designer"
      }
    }
  }
}
```

Replace `/absolute/path/to/OODS-Foundry-mcp` with your actual repo path.

### Cursor (stdio)

Copy the config from `configs/agents/cursor.stdio-mcp.json` into `.cursor/mcp.json` at the project root:

```json
{
  "mcpServers": {
    "oods-foundry": {
      "command": "node",
      "args": ["packages/mcp-adapter/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### Adapter Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCP_TOOLSET` | `default` | `default` = 11 auto tools; `all` = all 20 tools |
| `MCP_EXTRA_TOOLS` | (none) | Comma-separated on-demand tools (e.g., `a11y.scan,vrt.run`) |
| `MCP_ROLE` | `designer` | Role for policy enforcement (`designer` or `maintainer`) |
| `OODS_NODE_PATH` | `process.execPath` | Override the Node binary for spawning the native server |

### Adapter Features

- 20 tools with human-readable descriptions and typed JSON Schema input parameters
- MCP annotations (readOnlyHint, destructiveHint) derived from server policy
- Dynamic tool registration from server registry.json — zero adapter changes for new tools
- Structured error messages with actionable fix guidance for server spawn failures

## HTTP Bridge

For clients that only support HTTP transport (OpenAI Agents, custom integrations), use the HTTP bridge:

```bash
# Start the bridge (spawns the server subprocess automatically)
pnpm --filter @oods/mcp-bridge run dev
```

The bridge defaults to port `4466`. Set `MCP_BRIDGE_PORT=<port>` to change it. Optional: export `BRIDGE_TOKEN` to enforce the `X-Bridge-Token` header.

The bridge exposes `GET /health`, `GET /tools`, `POST /run`, and `/artifacts/*`.

## Claude Remote MCP

`configs/agents/claude.remote-mcp.json` contains a ready-to-drop profile. Copy the `claudeDesktopConfig` block into `~/.claude/mcp.json` (or the per-OS Claude Desktop configuration path):

```json
{
  "mcpServers": {
    "oods-foundry-bridge": {
      "type": "remote",
      "url": "http://127.0.0.1:4466"
    }
  }
}
```

Key points:

- The bridge serves diagnostics/read tools plus apply-gated tools. `repl.render` supports both `dry-run` and `apply` modes, while write-gated tools still require an approval header when `apply:true`.
- Because Claude Desktop omits custom headers for remote servers, keep token enforcement disabled when using this profile.
- If the default port is busy, start the bridge with `MCP_BRIDGE_PORT=<port>` and update the `url` accordingly.

## OpenAI Responses/Agents

`configs/agents/openai.agents.json` captures a thin agent profile pointing to the bridge:

- Default base URL: `http://127.0.0.1:4466`
- Function tool definition: `diag_snapshot` (maps to internal MCP tool `diag.snapshot`)
- Request template: `POST /run` with `{"tool":"diag_snapshot","input":{"apply":false}}`

Integrate it by:

1. Loading the JSON and registering the function schema with the Responses/Agents API.
2. Supplying a tool-calling callback that issues the documented `POST /run` request. Forward `X-Bridge-Token` when the bridge enforces tokens, and only pass `X-Bridge-Approval` when escalating to write tools.
3. Keeping `apply` set to `false` for diagnostics-only runs.

Before each session, call `GET /tools` to refresh the allowlisted names; the harness logs them for reference.

## Tool Name Translation (Workbench)

Bridge `/run` accepts either:

- External bridge names (underscores, returned by `GET /tools`): `structuredData_fetch`, `repl_render`, `diag_snapshot`
- Internal MCP names (dots, accepted for backward compatibility): `structuredData.fetch`, `repl.render`, `diag.snapshot`

Recommendation for Synthesis Workbench:

- Use the exact names returned by `GET /tools` (underscore form) when calling `/run`.
- Keep existing dot-form callers temporarily; bridge maps them to the same internal MCP tools.
- For the full endpoint/header/request/response contract, use `docs/mcp/Workbench-Integration-Contract.md`.

## Smoke Harness

The mission ships `tools/agents-smoke`, a minimal TypeScript CLI that exercises the bridge end-to-end:

```bash
pnpm --filter @oods/agents-smoke run
```

Behaviour:

- Reads `BRIDGE_URL`, `BRIDGE_TOKEN`, and `BRIDGE_APPROVAL` (defaults: `http://127.0.0.1:4466`, no token, no approval).
- Checks `/health`, lists tools, then runs `diag.snapshot` with `apply:false`.
- Prints artifact paths, bundle index, and diagnostics summary to verify the toolchain.

When the bridge picks an ephemeral port, start the harness with `BRIDGE_URL=http://127.0.0.1:<actualPort> pnpm --filter @oods/agents-smoke run`.
`diag.snapshot` can take up to two minutes to collect diagnostics; extend the wait with `BRIDGE_TIMEOUT=120000` (default) or higher if your environment is slower.

Flags:

- `--tool <name>` – choose a different bridge tool (must be allowlisted).
- `--apply` – send `apply:true` plus `X-Bridge-Approval` (requires the header value in `BRIDGE_APPROVAL`).

Use the harness after any connector or policy change to confirm the bridge still returns artifacts under `artifacts/current-state/<date>/`.

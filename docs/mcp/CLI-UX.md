# OODS Agent CLI

The OODS Agent CLI gives maintainers a local harness for running MCP tools with the same guardrails as the sandbox server. It wraps the stdio MCP server, produces signed transcripts (using the artifact framework), and enforces a plan → approve → execute flow with replay support.

## Quick start

```bash
# Dry-run a tool (no writes)
pnpm exec tsx tools/oods-agent-cli/src/index.ts plan tokens.build '{"theme":"dark"}'

# Apply writes (requires explicit approval)
pnpm exec tsx tools/oods-agent-cli/src/index.ts apply tokens.build '{"theme":"dark"}' --approve

# Replay a previous transcript
pnpm exec tsx tools/oods-agent-cli/src/index.ts replay artifacts/current-state/<date>/cli/tokens.build/<timestamp>-apply/transcript.json --approve
```

The script uses the built MCP server at `packages/mcp-server/dist/index.js`. Run `pnpm --filter @oods/mcp-server build` if the dist output is missing.

## Commands

- `plan <tool> [jsonArgs] [--role <role>]`  
  Spawns the MCP server in DRY-RUN (`apply=false`), prints bundle/transcript locations, and emits a signed CLI transcript under `artifacts/current-state/<date>/cli/<tool>/`.

- `apply <tool> [jsonArgs] --approve [--role <role>]`  
  Requires `--approve` before forwarding the request with `apply=true`. On success, lists all artifacts written and records the signed transcript/bundle pair.

- `replay <transcriptPath> [--approve] [--role <role>]`  
  Verifies the transcript signature, re-hashes declared input artifacts, and runs a fresh plan preview. If the original run applied writes, the apply step is re-issued only when `--approve` is supplied. Every replay produces a new signed CLI transcript that references the source transcript as an input artifact.

JSON arguments can be provided inline (`'{"key":"value"}'`) or via file reference (`@path/to/payload.json`).

## Outputs

Each invocation produces both server and CLI artifacts:

- The server’s `transcript.json` + `bundle_index.json` inside `artifacts/current-state/<date>/<tool>/` (whatever the MCP server writes).
- A CLI subdirectory at `artifacts/current-state/<date>/cli/<tool>/<timestamp>-<command>/` with a signed transcript, `summary.json`, and `bundle_index.json` that signs both files and any discovered artifacts.
- Artifact hashes are recomputed on write; transcripts use `@oods/artifacts` signing (`TRANSCRIPT_SCHEMA_VERSION` from that package) and capture role, payload, apply flag, incident metadata, and replay provenance when present.

Policy failures (role denial, validation errors, rate limits) exit with status code `2`; usage mistakes exit with `1`. Successful runs exit `0`.

## Error taxonomy & exit codes

Errors are normalised before printing:
- `POLICY_DENIED` and HTTP `401/403` → “Policy blocked” guidance, exit `2`
- `TIMEOUT` or MCP process crashes → exit `2`
- `RATE_LIMITED` (includes 429) → exit `2`
- `VALIDATION_ERROR` (bad tool name/JSON/media type) → exit `1`
- Unknown errors fall back to a generic “Run failed” descriptor (exit `1`)

Each error prints the taxonomy code (and source HTTP status when available), plus incident ID if supplied by the server. Set `DEBUG=1` to dump server-provided details.

## Replay guardrails

- Transcripts are signature-verified and input artifacts are re-hashed before any replay. Missing or mismatched inputs block the run.
- Replays always run a fresh preview; apply only runs when `--approve` is present, even if the source transcript recorded an apply.
- The recorded MCP role is reused unless `--role` overrides it.

## Roles and approvals

- `--role <role>` sets the MCP role for the request (defaults to `designer` via server policy).
- `--approve` is mandatory for any action that would write artifacts, including replays of previous apply runs.

## Future hooks

The CLI is intentionally minimal: it does not yet stream tool output or diff artifact contents. The transcript format leaves room for richer previews and for integrating with the Storybook Agent panel once write flows are enabled.

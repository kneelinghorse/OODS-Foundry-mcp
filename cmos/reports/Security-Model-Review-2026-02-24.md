# Security Model Review (2026-02-24)

Scope: `packages/mcp-server` (stdio MCP server + tool handlers).

## Executive summary

The v1 hardening pass focused on preventing common server-class vulnerabilities when tools accept untrusted JSON:

- Prototype pollution was possible via patch paths and token deltas. This is now blocked.
- Structured data resolution is now constrained to known directories (prevents manifest/path traversal).
- Policy defaults now require explicit per-tool rules (removes implicit allow-all).

## Findings (severity-rated)

### CRITICAL — Prototype pollution via patch paths

**Impact:** A crafted `repl.render` / `repl.validate` patch could traverse into prototype objects (e.g. `__proto__`, `constructor.prototype`) and mutate `Object.prototype`, affecting subsequent requests.

**Fix:** Block unsafe JSON pointer/path segments (`__proto__`, `constructor`, `prototype`) and prevent traversal into inherited properties.

- Fixed in: `packages/mcp-server/src/tools/repl.utils.ts`
- Tests: `packages/mcp-server/test/contracts/security.model.spec.ts`

### HIGH — Prototype pollution via `brand.apply` deltas/patches

**Impact:** A crafted token delta could inject unsafe keys (`__proto__`, `constructor`, `prototype`) and corrupt in-memory objects.

**Fix:** Reject unsafe keys during delta normalization and merge.

- Fixed in: `packages/mcp-server/src/tools/brand.apply.ts`
- Tests: `packages/mcp-server/test/contracts/security.model.spec.ts`

### MEDIUM — Structured data path traversal via manifest-controlled paths

**Impact:** If `artifacts/structured-data/manifest.json` is compromised, tools could be tricked into reading files outside the intended structured-data/planning directories.

**Fix:** Constrain resolved dataset paths to `artifacts/structured-data/` and `cmos/planning/` (and keep outputs repo-relative where possible).

- Fixed in: `packages/mcp-server/src/tools/structuredData.fetch.ts`
- Hardened in: `packages/mcp-server/src/tools/catalog.list.ts`
- Hardened in: `packages/mcp-server/src/tools/repl.utils.ts` (registry manifest path)

### MEDIUM — Policy default allow-all via wildcard rule

**Impact:** New tools could become implicitly available to public roles without an explicit policy entry.

**Fix:** Removed the wildcard (`tool="*"`) rule and added explicit rules for every shipped tool.

- Fixed in: `packages/mcp-server/src/security/policy.json`

### LOW — Absolute path leakage in some error paths

**Impact:** Some errors previously returned absolute host paths (informational disclosure risk on remote deployments).

**Fix:** Error messages no longer embed absolute structured-data paths where avoidable.

- Fixed in: `packages/mcp-server/src/tools/catalog.list.ts`
- Fixed in: `packages/mcp-server/src/tools/structuredData.fetch.ts`
- Hardened in: `packages/mcp-server/src/tools/repl.utils.ts` (warning paths now repo-relative)

## Notes / recommendations

- Consider upgrading `withinAllowed()` to compare realpaths if you expect symlinks inside the artifacts directory and want to defend against symlink-escape writes.
- Keep adding per-tool policy rules as new tools are introduced (default is now deny).


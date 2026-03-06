# Sprint 77 Mission 04 — Docs and Tool-Surface Alignment

**Mission:** `s77-m04`  
**Date:** 2026-03-05 22:26 CST / 2026-03-06 UTC  
**Scope:** Align README and MCP docs with the live tool surface and current semantics, including schemaRef TTL, schema persistence tools, object/viz/pipeline inventory, apply behavior, compact mode, and trait-name format expectations.

## Summary

The top-level MCP docs now match the live published surface:

- README now reflects the current default tool inventory: **22 auto tools**, **9 on-demand tools**, **31 total**
- README inventory counts now match the current structured-data export surface: **101 components**, **41 traits**, **12 objects** from `structuredData.fetch(dataset="components")` version `2026-03-06`
- `docs/mcp/Tool-Specs.md` now documents the full default tool surface instead of stopping at the older 11-tool subset
- `docs/mcp/Connections.md` now describes the current default/all tool counts and clarifies on-demand enablement for bridge/OpenAI examples
- `docs/mcp/Integration-Guides.md` now uses default-surface examples and explicitly gates `diag.snapshot` behind `MCP_EXTRA_TOOLS`

The key cross-tool semantics are now documented consistently across README and MCP docs:

- `schemaRef` TTL is 30 minutes unless persisted with `schema.save`
- `apply` remains dry-run by default for write-capable tools; `repl.render` HTML output is explicitly apply-gated
- `compact` mode is documented as default-on for `pipeline` and opt-in via `output.compact` for `repl.render`
- trait-name expectations are now separated by tool family:
  - structured-data/catalog/mapping traits use canonical exported names like `Stateful`
  - object filters accept namespaced refs like `lifecycle/Stateful` or suffix matches
  - viz traits use hyphenated ids like `mark-bar`

## Files Updated

- `README.md`
- `docs/mcp/Tool-Specs.md`
- `docs/mcp/Connections.md`
- `docs/mcp/Integration-Guides.md`

## Verification

### Live source-of-truth checks

Used runtime/tooling sources instead of stale doc text:

- `packages/mcp-server/src/tools/registry.json`
  - confirmed **22 auto** tools and **9 on-demand** tools
- `structuredData.fetch(dataset="components")`
  - confirmed version `2026-03-06`
  - confirmed `componentCount: 101`, `traitCount: 41`, `objectCount: 12`
- `health()`
  - confirmed the server is healthy and that registry/token/schema-store status is available for connection and readiness docs

### Documentation consistency sweep

Used repository search plus file inspection to verify:

- stale `20 tools` / `11 auto tools` wording was removed from the updated core docs
- README and `Tool-Specs.md` now both describe:
  - `schemaRef` TTL + `schema.save`
  - `apply` semantics
  - `compact` behavior
  - trait-name format expectations
- `Connections.md` now clarifies that `diag.snapshot` is on-demand in bridge/OpenAI examples
- `Integration-Guides.md` no longer treats `diag.snapshot` as part of the default surface

## Roadmap Interpretation

This mission closes the documentation-alignment gap, not every related runtime polish item:

- TTL documentation gap: closed
- trait-name format documentation gap: closed
- `apply` behavior documentation gap: closed, even though tool behaviors still differ intentionally by tool family
- compact-mode documentation gap: closed, even though `pipeline` and `repl.render` still have different runtime ergonomics

## Mission Outcome

Success criteria satisfied:

1. Core MCP docs and README now reflect the live default tool surface and current inventory counts.
2. `schemaRef` TTL, apply semantics, compact-mode behavior, and trait-name expectations are documented consistently across README and MCP docs.
3. The updated examples no longer imply that on-demand tools are available on the default surface, and the README points readers to the current setup and tool-inventory sources.

# MCP Tool Inventory (v0.2)

This file lists MCP tools, their default registration mode, and quick contract notes. The auto-registered list is intentionally small to keep agent tool prompts lean.

## Registration modes

- Auto: registered by default.
- On-demand: registered only when explicitly enabled.

Enable on-demand tools:

- `MCP_TOOLSET=all` to register every tool in the registry.
- `MCP_EXTRA_TOOLS=a11y.scan,vrt.run` to register a specific subset.

Registry source: `packages/mcp-server/src/tools/registry.json` (copied to `dist/tools/registry.json` on build).

## Tool decision table

| Tool | Status | Purpose | Notes |
| --- | --- | --- | --- |
| tokens.build | auto | Build tokens | Core agent tool. |
| structuredData.fetch | auto | Read structured data | Core agent tool. |
| repl.validate | auto | Validate Design Lab schemas | Core agent tool. |
| repl.render | auto | Render Design Lab previews | Core agent tool. |
| brand.apply | auto | Apply brand overlays | Core agent tool; approval-gated writes. |
| diag.snapshot | on-demand | Diagnostics snapshot | Useful for audits; not needed for most design flows. |
| reviewKit.create | on-demand | Build review kits | Heavy; enable when needed. |
| billing.reviewKit | on-demand | Billing review kit | Domain-specific; enable when needed. |
| billing.switchFixtures | on-demand | Switch billing fixtures | Domain-specific; enable when needed. |
| a11y.scan | on-demand | Accessibility scan | Audit tool; keep on-demand. |
| purity.audit | on-demand | Purity audit | Audit tool; keep on-demand. |
| vrt.run | on-demand | Visual regression run | Audit tool; keep on-demand. |
| release.verify | on-demand | Release verification | Maintainer-only; keep on-demand. |
| release.tag | on-demand | Tag release artifacts | Maintainer-only; keep on-demand. |
| repl.utils (internal) | internal | REPL helpers | Not an MCP tool; shared helper module. |
| repl.patch (internal) | internal | REPL patch schema | Not an MCP tool; schema only. |

## Contract summary (quick view)

- tokens.build
  - input: brand A, theme light|dark|hc, apply=false
  - output: artifacts[], transcriptPath, bundleIndexPath

- a11y.scan, purity.audit, vrt.run, reviewKit.create, diag.snapshot
  - input: apply=false
  - output: artifacts[], transcriptPath, bundleIndexPath

- billing.reviewKit
  - input: object Subscription|Invoice|Plan|Usage, fixtures["stripe","chargebee"], apply=false
  - output: artifacts[], transcriptPath, bundleIndexPath, preview diffs/specimens

- billing.switchFixtures
  - input: provider stripe|chargebee, apply=false
  - output: artifacts[], transcriptPath, bundleIndexPath, preview diffs/stories

Transport: newline-delimited JSON via stdio: { id?, tool, input }

# OODS Foundry MCP Full User Test

**Date:** 2026-03-06  
**Tester:** Codex GPT-5  
**CMOS Session:** `PS-2026-03-06-001`  
**Repo:** `OODS-Foundry-mcp`  
**Server health at start:** `0.1.0`, registry `97 components / 37 traits / 11 objects`, DSL `1.0`

## Executive Summary

This was a broad, hands-on user test of the updated OODS Foundry MCP, using the live tool surface rather than only the published docs. The result is mixed:

- The **discovery, object, schema persistence, token build, accessibility, diagnostics, and billing artifact** workflows are materially better than the March 4 reports suggested.
- The **composition layer is still the weakest part of the product**. It can now see rich object metadata, but it often converts that richness into generic or semantically wrong scaffolding.
- There are still **hard reliability defects** in the shipped MCP surface: built-in flows emit invalid components, some artifact tools fail on first run, and the docs/integration surface is out of sync with the live server.

## Overall Assessment

**Agent UX score:** `6.5/10`

Why:

- Good when the tool is artifact-oriented and deterministic.
- Frustrating when the tool is composition-oriented and semantic correctness matters.
- Discoverability is undermined by stale docs and by mismatches between the repo docs, the live server, and the agent tool binding.

## Tool Coverage

### Worked Well

| Tool | Result | Notes |
|---|---|---|
| `health` | Pass | Good summary, changelog, registry counts, saved schema count. |
| `structuredData.fetch` | Pass | ETag match behavior and version listing work cleanly. |
| `catalog.list` | Pass | Useful `availableCategories`; rich summary payload. |
| `object_list` | Pass | Strong addition; gives real object inventory. |
| `object_show` | Pass | One of the best tools in the surface. Rich schema, semantics, tokens, view extensions, warnings, file path. |
| `map.list` | Pass | Existing mappings visible. |
| `map.resolve` | Pass | Clean translation summary; coercion surfaced. |
| `map.delete` | Pass on error UX | Nonexistent ID returned a helpful error with next step. |
| `repl.validate` | Pass | Default full validation worked without the older contract friction. |
| `repl.render` | Pass on valid schema | Compact output is much more MCP-friendly. |
| `code.generate` | Pass technically | Output is syntactically usable, but semantic quality varies sharply with input schema quality. |
| `pipeline` | Pass on valid `Subscription detail` | Compose → validate → render → codegen → save completed. |
| `schema.save/list/load/delete` | Pass | Tags, author, object metadata, and cleanup all worked. |
| `tokens.build` | Pass | Wrote artifacts with clear paths, hashes, and sizes. |
| `brand.apply` | Pass (preview) | Preview diff is clear and agent-friendly. |
| `a11y.scan` | Pass | Produced a clean artifact and compliance summary. |
| `diag.snapshot` | Pass | Good compact summary plus diagnostics JSON. |
| `billing.reviewKit` | Pass | Strong artifact bundle and useful structured diffs. |
| `billing.switchFixtures` | Pass (preview) | Preview is detailed and understandable. |

### Worked, But With Significant Quality Problems

| Tool | Result | Notes |
|---|---|---|
| `design.compose` | Partial | Object awareness exists, but output quality is still inconsistent and often semantically wrong. |
| `viz.compose` | Partial | Better auto-binding than older reports, but currently emits invalid schemas due to `Box`. |

### Failed

| Tool | Result | Notes |
|---|---|---|
| `pipeline(object="Product", context="list")` | Fail | Compose emitted `ActiveFilterChips`, validator rejected it as not in registry. |
| `reviewKit.create` | Fail | `ENOENT` on its own output file; asked for server rebuild. |
| `purity.audit` | Fail | Same `ENOENT` pattern as `reviewKit.create`. |
| `repl.render` on viz schema | Fail | Correctly rejected invalid schema caused by `Box` not being in registry. |

### Blocked / Not Fully Testable

| Tool | Result | Notes |
|---|---|---|
| `map.create` | Blocked | Repo docs/specs list it, but this agent session did not expose it. |
| `release.verify` | Blocked by role | Error was explicit: `Role 'designer' not allowed`. |
| `release.tag` | Blocked by role | Same; error UX was clear. |
| `vrt.run` | Dry-run only | Returned transcript/bundle paths but no substantive preview content. |

## Highest Priority Defects

### 1. Built-in object composition can emit invalid components and break pipeline

**Severity:** High  
**Repro:** `design_compose(object="Product", context="list", options.validate=true)`  
**Observed:** The composed schema contains `ActiveFilterChips`, and validation fails with:

`OODS-V006: Component 'ActiveFilterChips' is not in the OODS registry`

**Why it matters:** This breaks a first-party happy path on a first-party object.

**Likely root cause:**

- `OODS-Foundry-mcp/traits/behavioral/Filterable.trait.yaml` references `ActiveFilterChips`
- That component does **not** appear in the 2026-03-01 structured component registry export

This is a direct trait-to-registry drift bug.

### 2. `viz.compose` emits invalid schemas by default

**Severity:** High  
**Repro:** `viz_compose(chartType="line", ...)` or `viz_compose(object="Usage", ...)`  
**Observed:** Root node is `Box`; `repl.validate` rejects it:

`OODS-V006: Component 'Box' is not in the OODS registry`

**Additional problem:** `code.generate` still emits code importing `Box`, even though validation fails. That means codegen can happily generate code from an invalid schema.

**Likely root cause:**

- `OODS-Foundry-mcp/packages/mcp-server/src/tools/viz.compose.ts` hardcodes `component: 'Box'`
- `Box` is treated as a primitive in tests/tooling, but it is not present in the live registry/catalog

This is a deeper contract mismatch between the schema primitive set and the exported registry.

### 3. `reviewKit.create` and `purity.audit` are shipping in a broken state

**Severity:** High  
**Observed:** Both fail on first run with `ENOENT` on expected output files and advise rebuilding the server.

Examples:

- `reviewKit.create`: missing `review-kit.txt`
- `purity.audit`: missing `purity-audit.json`

**Why it matters:** Artifact tools should not require users to discover a local rebuild step after the MCP is already running.

**Assessment:** This looks like a packaging or dist sync problem, not user error.

## Important Quality Problems

### 4. Object-aware composition still produces semantically weak output

`Subscription detail` is the best example. The object layer now exposes real structure:

- traits
- schema
- semantic mappings
- tokens
- composed view extensions

But the resulting UI still has poor semantic yield:

- `pipeline` reported `23 totalNodes` and only `2 fieldsBound`
- most tabs degraded into empty `Card` placeholders
- only a small fraction of the object model was expressed in the output

This is better than totally generic scaffolding, but it is still far from “semantic middleware.”

### 5. View extension rebinding can become semantically wrong

`design_compose(object="User", context="list")` produced several clearly wrong bindings:

- `StatusBadge field="role"` instead of the lifecycle `status`
- `RelativeTimestamp field="address_roles"` instead of `updated_at`
- `TagPills field="channel_catalog"` instead of `tags`

These are not just suboptimal choices; they are misleading UIs.

This suggests the field-affinity rebinding layer is overriding explicit trait-driven intent too aggressively.

### 6. Trait slot vocabulary and layout slot vocabulary do not line up

The `User` list composition raised multiple `OODS-V120` warnings:

- no matching slot for `position: before`
- no matching slot for `position: after`

Affected trait-driven components included:

- `MessageStatusBadge`
- `AddressSummaryBadge`
- `PreferenceSummaryBadge`
- `RoleBadgeList`

These components are valid and exist in the registry/export, but the list layout did not expose compatible slots for them.

This is a contract mismatch between:

- trait `view_extensions.position`
- the layout slot model used by `design.compose`

### 7. `repl.render` preview messaging can be misleading on invalid schemas

On the invalid viz schema, `repl.render` returned `status: "error"` and a missing-component error, but the preview summary still said:

`Render ready for 1 screen`

That is misleading in agent workflows. The preview summary should not read as success when the render step is rejected.

## Documentation / Discoverability Problems

### 8. Docs are out of sync with the live server

The current docs materially under-describe the live surface:

- `README.md` still reports `73 components / 35 traits / 12 objects`
- live `health` reported `97 / 37 / 11`
- `docs/mcp/Tool-Specs.md` documents the older core surface but does **not** document the live `object_*`, `schema_*`, `viz.compose`, or `pipeline` tools that were available and useful in this session

This forces agent users to discover critical capabilities by probing, not by reading.

### 9. The agent binding and the server docs disagree on `map.create`

The repo docs/specs list `map.create`, but this session did not expose it to the agent. I could test `map.list`, `map.resolve`, and `map.delete`, but not `map.create`.

Whether the issue is in tool registration, bridge exposure, or agent binding, this is a real UX/integration defect.

### 10. Small contract footguns remain

The most obvious one I hit:

- `repl.render` requires `output.format: "fragments"` rather than `"fragment"`

The error message is fine, but this is still an easy stumble because singular/plural is not memorable.

## OODS Model / Trait Issues

### 11. Trait-to-component registry drift exists

This is the clearest model-level defect from the test.

- `Filterable.trait.yaml` references `ActiveFilterChips`
- the registry export used by the validator does not include it

The trait system and component registry are not moving together reliably.

### 12. `Subscription` still has schema collision hygiene issues

`object_show("Subscription")` returned:

`Field collision: "notes" in object schema overrides trait definition`

The warning is good. The underlying collision is not.

### 13. `Usage` is not viz-ready despite viz tooling now existing

`viz_compose(object="Usage")` worked better than earlier reports, but it still warned:

`Object "Usage" has no viz mark traits. Falling back to bar chart.`

The object can auto-bind fields, but it still lacks enough explicit viz semantics to choose a chart intentionally.

### 14. Internal primitive vocabulary is inconsistent

The system appears to conceptually support `Box`, but not operationally:

- used in `viz.compose`
- used in tests
- rejected by validator/registry

That indicates a split between internal schema assumptions and public registry reality.

## What Improved Since Earlier Reports

Several areas are clearly better than the March 4 assessments:

- `object_list` and `object_show` now exist and are genuinely useful
- `schema.save/list/load/delete` work well
- `pipeline save` preserved tags and object metadata correctly
- `repl.validate` no longer required the older awkward handholding I expected from previous reports
- `structuredData.fetch` ETag behavior and version listing are solid
- `tokens.build`, `a11y.scan`, `diag.snapshot`, and billing review workflows feel much more production-like than the composition side

## Best Parts Of The Current UX

### Strongest areas

1. **Object introspection**
   - `object_show` is excellent.
   - It gives the agent enough data to reason meaningfully about the system.

2. **Artifact-returning tools**
   - Tools that produce artifacts are the strongest part of the MCP.
   - Paths, transcripts, hashes, and bundle indexes are all helpful for agent workflows.

3. **Error messaging**
   - Many errors are actionable:
   - role gating is explicit
   - missing mapping errors suggest `map.list`
   - missing component errors provide direct paths

## Weakest Parts Of The Current UX

### Most frustrating areas

1. **Composition trustworthiness**
   - I cannot trust object-aware output without manually reading the schema.

2. **Docs vs live surface**
   - The product currently requires live probing to discover real capabilities.

3. **Inconsistent validity guarantees**
   - Some tools generate output from schemas that other tools reject.

4. **Trait/layout contract mismatch**
   - “before/after/sidebar/top” placement is not consistently grounded in a universal slot model.

## Recommendations

### P0

1. Fix trait-to-registry drift for `ActiveFilterChips`, or block composition from emitting components absent from the active registry.
2. Fix `viz.compose` to emit a registry-valid root component, or register `Box` as a real schema primitive/component.
3. Fix `reviewKit.create` and `purity.audit` packaging so first-run artifact generation works without a rebuild.
4. Align the published docs with the live tool surface, especially:
   - `object_list`
   - `object_show`
   - `schema_*`
   - `viz.compose`
   - `pipeline`
   - current inventory counts
5. Resolve the `map.create` exposure mismatch in the agent/bridge binding.

### P1

6. Stop the field-affinity layer from overriding explicit trait semantics with semantically worse bindings.
7. Unify trait positions and compose slots so `before/after/sidebar/top` do not get dropped at runtime.
8. Make `code.generate` refuse or warn on invalid schemas instead of emitting code that depends on missing registry components.
9. Make `repl.render` success messaging reflect validation state more honestly.

### P2

10. Add a compact tool manifest or discovery tool that returns the **actual** enabled MCP surface for the running server/session.
11. Tighten output consistency:
    - `bundleIndexPath` naming
    - `fragments` vs `fragment`
    - `apply` semantics across write-capable tools
12. Expand object-level viz readiness for `Usage` and other analytics-facing objects.

## Artifacts Generated During This Test

Successful artifact directories included:

- `OODS-Foundry-mcp/artifacts/current-state/2026-03-06/tokens.build/`
- `OODS-Foundry-mcp/artifacts/current-state/2026-03-06/a11y.scan/`
- `OODS-Foundry-mcp/artifacts/current-state/2026-03-06/diag.snapshot/2026-03-06T00-23-03-418Z/`
- `OODS-Foundry-mcp/artifacts/current-state/2026-03-06/billing.reviewKit/2026-03-06T00-23-09-677Z/`

I also created two temporary saved schemas to test persistence and then removed them successfully:

- `oods-uat-subscription-detail-20260306`
- `oods-uat-user-list-20260306`

## Final Verdict

The MCP is no longer just a toy surface. The object and artifact layers are starting to feel like a real agent-facing platform.

But the **core promise of OODS Foundry is semantic composition**, and that is still where the platform is least reliable. Right now the system is best described as:

- strong at introspection
- strong at artifact generation
- moderate at schema mechanics
- weak at trustworthy semantic composition

If I were using this as a daily agent tool, I would trust it for:

- discovery
- audits
- registry inspection
- token artifacts
- billing review artifacts

I would **not** trust it yet for:

- object-driven UI composition without human inspection
- viz generation as a stable public path
- some of the secondary artifact tools until the packaging failures are fixed

# Sprint 81 Closure — Public Beta Trust + DX Polish

Date: 2026-03-06
Session: `PS-2026-03-06-020`
Baseline commit: `faa008b`

## Scope

Sprint 81 stayed intentionally narrow and incremental. The goal was to convert the final Claude Code UX feedback into trust-building fixes without reopening the green public-beta release state or broadening into a redesign sprint.

## Fresh-build verification

Commands executed:

```bash
node --input-type=module -e "import { rmSync } from 'node:fs'; for (const p of ['packages/mcp-server/dist','packages/tokens/dist']) rmSync(p, { recursive: true, force: true });"
pnpm --filter @oods/tokens run build
pnpm --filter @oods/mcp-server run build
node --input-type=module -e "import { handle as composeHandle } from './packages/mcp-server/dist/tools/design.compose.js'; const lowConfidence = await composeHandle({ intent: 'something completely unrelated xyz' }); const lowSelection = lowConfidence.selections.find((selection) => selection.confidenceLevel === 'low'); const override = await composeHandle({ object: 'Subscription', context: 'detail', preferences: { componentOverrides: { 'tab-0': 'Card' } } }); const overrideSelection = override.selections.find((selection) => selection.slotName === 'tab-0'); console.log(JSON.stringify({ lowConfidence: { status: lowConfidence.status, lowConfidenceSlotNames: lowConfidence.meta?.intelligence?.lowConfidenceSlotNames ?? [], reviewHint: lowSelection?.reviewHint ?? null }, override: { status: override.status, selectedComponent: overrideSelection?.selectedComponent ?? null, explanation: overrideSelection?.explanation ?? null, reviewHint: overrideSelection?.reviewHint ?? null } }, null, 2));"
node --input-type=module -e "import { handle as pipelineHandle } from './packages/mcp-server/dist/tools/pipeline.js'; const result = await pipelineHandle({ intent: 'list', layout: 'list', preferences: { componentOverrides: { items: 'Table' } }, framework: 'react', options: { compact: false } }); console.log(JSON.stringify({ error: result.error ?? null, steps: result.pipeline.steps, renderHasTable: result.render?.html?.includes('data-oods-component=\"Table\"') ?? false, codeHasTable: result.code?.output.includes('data-oods-component=\"Table\"') ?? false }, null, 2));"
pnpm exec vitest run packages/mcp-server/test/contracts/contract-alignment.spec.ts packages/mcp-server/test/contracts/mapping.spec.ts packages/mcp-server/test/compose/confidence-scoring.spec.ts packages/mcp-server/test/contracts/schema-ref.workflow.spec.ts
pnpm exec vitest run src/tools/__tests__/pipeline.test.ts
```

Results:

- Fresh token build: passed.
- Fresh `@oods/mcp-server` build: passed.
- Built `design.compose` smoke:
  - low-confidence selections surfaced `lowConfidenceSlotNames` and `reviewHint`
  - explicit overrides returned `Card` with a clear `preferences.componentOverrides` explanation and no review hint
- Built `pipeline` smoke:
  - no error
  - override survived through render and code generation (`Table` present in both outputs)
- Targeted test sweep:
  - root: 77/77 passed
  - package-local pipeline unit suite: 42/42 passed

Closeout finding fixed during fresh-build retest:

- The schema type generator had dropped the top-level `FieldSchemaEntry` alias relied on by codegen and compose modules. Restoring that alias in `packages/schemas-tools/src/generate-types.ts` and regenerating types returned the fresh package build to green.

## Feedback closure map

| Feedback item | Status | Closure |
|---|---|---|
| `pipeline.save` contract compatibility | Fixed | Added contract coverage confirming `save` accepts string and object forms with tags; latest tests pass. |
| `map.resolve` response semantics | Fixed | Kept runtime semantics (`status: "ok"` / `"not_found"`) and aligned docs/tests/examples to the actual contract. |
| `map.delete` response shape | Fixed | Kept runtime deleted-summary shape and aligned docs/tests/examples to the actual contract. |
| Example payload drift (`propMappings`) | Fixed | Updated the public prompt/example payloads to the real array-of-objects shape and coercion model. |
| Pipeline framework/typescript coverage gap | Fixed | Added targeted pipeline coverage for nested `options.framework` and `options.typescript` behavior. |
| Human-readable composition rationale | Fixed | `design.compose` selections now include `confidenceLevel`, `explanation`, and low-confidence `reviewHint`. |
| Low-confidence selections easy to detect | Fixed | `meta.intelligence.lowConfidenceSlotNames` now surfaces the affected slots directly. |
| Override story not front-and-center | Fixed | README + MCP docs now include a copyable `componentOverrides` example and explain when to use it. |
| Per-slot overrides in pipeline calls | Fixed | `pipeline` now forwards compose `preferences`, including `componentOverrides`, with fresh-dist smoke evidence. |
| Low-confidence rendered affordance (for example `data-oods-confidence`) | Deferred | Left out to keep Sprint 81 additive and avoid widening the HTML/render contract in a beta-trust polish sprint. |
| Project-level defaults file (`.oodsrc`) | Deferred | Useful, but out of scope for the short escape-hatch mission. |
| Interactive playground / onboard flow / schema migration / recovery objects / theming showcase | Deferred | Still valid follow-up opportunities, but not required to preserve the current public-beta-ready state. |

## Release framing

The release framing did not materially change in this sprint:

- public beta remains green
- the core status remains "Ready for Public Beta"
- no new platform score was assigned

Because the readiness framing did not change, `cmos/planning/roadmap-v1.md` was not updated in Sprint 81.

## Changed areas

- Contract/docs/tests: `packages/mcp-server/test/contracts/contract-alignment.spec.ts`, `packages/mcp-server/test/contracts/mapping.spec.ts`, `docs/mcp/Tool-Specs.md`, `cmos/reports/agent-test-prompt-sprint74.md`
- Pipeline coverage + override passthrough: `packages/mcp-server/src/tools/pipeline.ts`, `packages/mcp-server/src/tools/__tests__/pipeline.test.ts`, `packages/mcp-server/src/schemas/pipeline.input.json`, `docs/api/pipeline.md`
- Explainability + override messaging: `packages/mcp-server/src/tools/design.compose.ts`, `packages/mcp-server/test/compose/confidence-scoring.spec.ts`, `packages/mcp-server/src/schemas/design.compose.output.json`, `README.md`
- Generated contract sync: `packages/schemas-tools/src/generate-types.ts`, generated schema type outputs

## Deferred next steps

1. If public beta wants a stronger visual trust cue, add a rendered low-confidence affordance in a dedicated follow-up sprint rather than as a hidden HTML contract change.
2. If the pipeline is going to be the main public entrypoint, consider a short docs example for `preferences.theme` now that compose preferences pass through consistently.
3. If config defaults become important, scope `.oodsrc` as a separate configuration mission instead of growing the current preference surface ad hoc.

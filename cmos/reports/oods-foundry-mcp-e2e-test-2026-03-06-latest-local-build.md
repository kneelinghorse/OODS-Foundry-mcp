# OODS Foundry MCP Structured E2E Test Report

**Date:** 2026-03-06
**Tester:** Codex GPT-5
**Test Script:** `oods-mcp-e2e-test-script.md`
**Lane:** latest rebuilt local adapter + latest rebuilt local bridge
**CMOS Session:** `PS-2026-03-06-003`

## Build Provenance

- Commit: `994be9b8d817024d778b00ac57355e968abcb4ed`
- Commit date: 2026-03-06 00:48:37 -0600
- Commit subject: Merge pull request #40 from kneelinghorse/sprint-80
- Dist index mtime: 2026-03-06T14:29:00.080Z
- Dist registry mtime: 2026-03-06T14:29:00.272Z
- Rebuild commands run immediately before verification: `pnpm --filter @oods/mcp-server run build`, `pnpm --filter @oods/mcp-bridge run build`

## Harness Verification

- Adapter expected tools: 31
- Adapter actual tools: 31
- Bridge expected tools from repo policy file: 19
- Bridge allowed tools from dist config: 24
- Bridge actual tools: 24
- Bridge registry source: dist/tools/registry.json
- Adapter missing tools: none
- Adapter unexpected tools: none
- Bridge missing tools: none
- Bridge unexpected tools: map_create, map_list, map_resolve, object_list, object_show

The adapter is aligned with the rebuilt server registry. The bridge is running the rebuilt dist, but its built config is loading the fallback allowed-tool list rather than the repo policy file.

## Strict Script Result

- Passed: 20/25
- Failed: 5/25

## Phase Scorecard

| Phase | Passed | Failed | Notes |
| --- | ---: | ---: | --- |
| Discovery | 3 | 0 | Health, objects, and catalog surface |
| Composition | 3 | 0 | Payloads work; semantic quality is mixed |
| Validation & Render | 2 | 0 | schemaRef-only flows |
| Code Generation | 1 | 2 | React/Vue correctness remains the weak point |
| Pipeline | 2 | 0 | End-to-end lane and save support |
| Schema Persistence | 3 | 0 | Save/load/list/delete |
| Visualization | 2 | 0 | bar + object-driven chart compose |
| Mappings | 0 | 3 | Prompt drift versus current schema |
| Edge Cases | 4 | 0 | Invalid object/schemaRef and intent bounds |

## Findings

- Bridge policy loading: the built bridge is exposing the fallback allowed-tool set instead of the repo policy file. The extra tools are map_create, map_list, map_resolve, object_list, and object_show.
- Composition quality: Product detail compose is still Badge-heavy (8 Badge nodes), which dilutes the requested name/price/SKU focus.
- Composition quality: the User list filters slot still resolves to SearchInput instead of a filter-specific control.
- Pipeline semantics: the Organization dashboard card still pulls in unrelated summary panels instead of staying tightly scoped to plan tier, billing status, and member count.
- Codegen correctness: React output still shows duplicate local names and/or duplicate label props, so the generated TSX is not yet trustworthy.
- Codegen correctness: Vue output still redeclares props after defineProps destructuring.
- Current mapping implementation: a schema-compliant map.create -> map.resolve -> map.delete round-trip succeeds on the latest local build, so the remaining issue is prompt/docs drift rather than a broken mapping handler.

## Task Results

| Task | Result | Notes |
| --- | --- | --- |
| 1.1 | Pass | status=ok, components=101, objects=11 |
| 1.2 | Pass | object.list: totalCount=11; object.show: traits=8, viewExtensions=6 |
| 1.3 | Pass | catalog.list: totalCount=101, categories=behavioral, communication, content, core, financial, lifecycle, primitive, structural, visual, viz.encoding, viz.mark, viz.scale, viz.spatial; primitive filter: components=14 |
| 2.1 | Pass | layout=detail, selections=10 |
| 2.2 | Pass | layout=list, pagination=PaginationBar |
| 2.3 | Pass | layout=form |
| 3.1 | Pass | status=ok, mode=full |
| 3.2 | Pass | status=ok, htmlLength=90058 |
| 4.1 | Fail | status=ok, codeLength=14100 |
| 4.2 | Fail | status=ok, codeLength=12437 |
| 4.3 | Pass | status=ok, codeLength=89891 |
| 5.1 | Pass | steps=compose, validate, render, codegen |
| 5.2 | Pass | saved=transaction-receipt-v1@v1 |
| 6.1 | Pass | object=Transaction, tags=receipt, transaction |
| 6.2 | Pass | schema.list all: count=3; schema.list tags: count=1 |
| 6.3 | Pass | deleted=true |
| 7.1 | Pass | chartType=bar, slots=chart-area, controls-panel, role-badge |
| 7.2 | Pass | status=ok, traitsResolved=4 |
| 8.1 | Fail | status=undefined, applied=undefined |
| 8.2 | Fail | status=not_found |
| 8.3 | Fail | deleted=undefined |
| 9.1 | Pass | OODS-S004: Failed to load object "NonExistentThing": Object "NonExistentThing" not found. Available: Article, Invoice, Media, Organization, Plan, Product, Relationship, Subscription, Transaction, Usage, User |
| 9.2 | Pass | OODS-N003: schemaRef 'bogus-ref-12345' is missing. |
| 9.3 | Pass | Tool design_compose failed: Input validation failed: must NOT have fewer than 1 characters |
| 9.4 | Pass | layout=dashboard, sections=7 |

## Bridge Smoke Lane

```json
{
  "health": {
    "status": "ok",
    "bridge": "ready",
    "toolset": {
      "mode": "all",
      "enabledCount": 24,
      "registrySource": "dist/tools/registry.json"
    }
  },
  "compose": {
    "status": "ok",
    "layout": "detail",
    "schemaRef": "compose-99f13cad"
  },
  "validate": {
    "status": "ok",
    "mode": "full"
  },
  "render": {
    "status": "ok",
    "tokenCssRef": "tokens.build"
  },
  "pipeline": {
    "steps": [
      "compose",
      "validate",
      "render",
      "codegen"
    ],
    "summary": "Organization, view, with 5 fields, react/tokens, 13 components"
  },
  "viz": {
    "status": "ok",
    "chartType": "bar"
  }
}
```

## Recovery Checks

```json
{
  "compactRender": {
    "tokenCssRef": "tokens.build"
  },
  "mappingRoundTrip": {
    "create": {
      "status": "ok",
      "applied": true,
      "id": "material-ui-mui-data-grid"
    },
    "resolve": {
      "status": "ok",
      "propTranslations": [
        {
          "externalProp": "rows",
          "oodsProp": "data",
          "coercionType": "identity",
          "coercionDetail": {
            "type": "identity"
          }
        },
        {
          "externalProp": "columns",
          "oodsProp": "columnDefs",
          "coercionType": "identity",
          "coercionDetail": {
            "type": "identity"
          }
        }
      ]
    },
    "delete": {
      "status": "ok",
      "deleted": {
        "id": "material-ui-mui-data-grid",
        "externalSystem": "material-ui",
        "externalComponent": "MuiDataGrid"
      }
    }
  }
}
```

## Platform Score

| Category | Weight | Score | Notes |
| --- | ---: | ---: | --- |
| API Surface Completeness | 15 | 10/15 | Adapter matches the registry, but the bridge dist is loading fallback policy and the strict mapping payloads are stale |
| Composition Intelligence | 25 | 10/25 | Layout detection works, but slot ranking is still semantically weak |
| Code Generation Quality | 20 | 5/20 | HTML is acceptable; React and Vue still show correctness defects |
| Pipeline & Persistence | 15 | 13/15 | Save/load/list/delete and pipeline steps are working |
| Error Handling & DX | 10 | 8/10 | Strong structured errors, but prompt/schema drift still costs DX |
| Visualization | 10 | 8/10 | Chart composition and data aliasing are in good shape |
| Documentation & Discoverability | 5 | 3/5 | Discovery is good; the mapping examples in the current prompt are stale |
| **Total** | **100** | **57/100** | |

## Verdict

This report is based on the latest local build, not the stale pre-registered harness surface. The bridge does have a current dist/config bug and is loading fallback policy, but that is not the main reason the score is low. The main score drag is still real behavior in the current repo: weak semantic composition, invalid React/Vue code generation, and stale mapping payloads in the test prompt.

Concrete next fixes:

- Fix `packages/mcp-bridge/src/config.ts` repo-root resolution so the built bridge reads `configs/agent/policy.json` instead of silently falling back to the hardcoded policy.
- Fix React and Vue emitters so they stop redeclaring destructured props and emitting duplicate JSX props.
- Improve composition ranking so the requested business intent beats generic badge-heavy matches.
- Update `oods-mcp-e2e-test-script.md` mapping payloads to the latest schemas, or add backward-compatible coercion for the older shapes if that prompt must stay stable.
- Keep the current validation/render/pipeline/viz contract behavior; those lanes are working and should be protected with regression tests.

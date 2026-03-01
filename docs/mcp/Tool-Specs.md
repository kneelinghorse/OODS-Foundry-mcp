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

---

## Auto tool contracts (11 tools)

### `tokens.build`

- **Input schema**: `packages/mcp-server/src/schemas/tokens.build.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/generic.output.json`
- **Policy**: designer, maintainer | writes `${BASE}/${DATE}/**` | timeout 60s | rate 30/min | concurrency 1
- **Purpose**: Produce token artifacts (and always emit a transcript + bundle index).

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

---

### `structuredData.fetch`

- **Input schema**: `packages/mcp-server/src/schemas/structuredData.fetch.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/structuredData.fetch.output.json`
- **Policy**: designer, maintainer | read-only | timeout 30s | rate 60/min | concurrency 4
- **Purpose**: Read structured datasets (`components`, `tokens`, `manifest`) with stable ETag support.

Example input:
```json
{ "dataset": "components", "ifNoneMatch": "deadbeef", "includePayload": true }
```

Versioned access:
```json
{ "dataset": "components", "version": "2026-02-20", "listVersions": false }
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

Notes:
- `version` (YYYY-MM-DD) requests a specific artifact version. Exact match preferred; nearest-available returned with a warning.
- `listVersions: true` returns available versions without payload.

---

### `repl.validate`

- **Input schema**: `packages/mcp-server/src/schemas/repl.validate.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/repl.validate.output.json`
- **Policy**: designer, maintainer | read-only | timeout 30s | rate 60/min | concurrency 4
- **Purpose**: Validate UiSchema trees structurally and optionally check WCAG accessibility.

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

With accessibility checks:
```json
{
  "mode": "full",
  "checkA11y": true,
  "schema": { "..." : "..." }
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

Notes:
- `checkA11y: true` runs 18 WCAG contrast rules after structural validation passes. Failures appear as `A11Y_CONTRAST` warnings with contrast ratio, WCAG level, and fix hints.

---

### `repl.render`

- **Input schema**: `packages/mcp-server/src/schemas/repl.render.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/repl.render.output.json`
- **Policy**: designer, maintainer | writes `${BASE}/${DATE}/**` | timeout 30s | rate 60/min | concurrency 4
- **Purpose**: Render UiSchema trees to HTML. Supports document mode (self-contained page) and fragment mode (per-component HTML).

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

Fragment mode:
```json
{
  "mode": "full",
  "output": { "format": "fragment" },
  "schema": { "..." : "..." }
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

Notes:
- Document mode wraps output in a self-contained HTML page with inlined token CSS.
- Fragment mode returns per-component HTML fragments with `cssRefs` for CSS extraction.
- Unknown components in non-strict fragment mode produce per-node errors without blocking sibling rendering.

---

### `brand.apply`

- **Input schema**: `packages/mcp-server/src/schemas/brand.apply.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/brand.apply.output.json`
- **Policy**: designer, maintainer | writes `${BASE}/${DATE}/**` | timeout 120s | rate 12/min | concurrency 1
- **Purpose**: Preview or apply governed token overlays (alias merge or RFC 6902 patch).

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

---

### `catalog.list`

- **Input schema**: `packages/mcp-server/src/schemas/catalog.list.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/catalog.list.output.json`
- **Policy**: designer, maintainer | read-only | timeout 30s | rate 60/min | concurrency 4
- **Purpose**: List component catalog entries derived from `artifacts/structured-data` exports.

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

---

### `code.generate`

- **Input schema**: `packages/mcp-server/src/schemas/code.generate.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/code.generate.output.json`
- **Policy**: designer, maintainer | read-only | timeout 30s | rate 60/min | concurrency 4
- **Purpose**: Generate framework-specific code from a validated UiSchema. Supports React/TSX, Vue SFC, and HTML output.

Example input:
```json
{
  "schema": {
    "version": "2026.02",
    "screens": [
      {
        "id": "screen_main",
        "component": "Stack",
        "children": [
          { "id": "heading", "component": "Text", "props": { "content": "Welcome" } },
          { "id": "cta", "component": "Button", "props": { "label": "Get Started" } }
        ]
      }
    ]
  },
  "framework": "react",
  "options": { "typescript": true, "styling": "tokens" }
}
```

Example output:
```json
{
  "status": "ok",
  "framework": "react",
  "code": "import React from 'react';\n...",
  "fileExtension": ".tsx",
  "imports": ["react"],
  "warnings": [],
  "meta": { "nodeCount": 3, "componentCount": 3, "unknownComponents": [] }
}
```

Input fields:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema` | UiSchema | Yes | A validated UiSchema tree |
| `framework` | `"react"` \| `"vue"` \| `"html"` | Yes | Target framework |
| `options.typescript` | boolean | No (default `true`) | Emit TypeScript types (React/Vue). Ignored for HTML. |
| `options.styling` | `"inline"` \| `"tokens"` | No (default `"tokens"`) | Styling strategy: inline style objects or design-token CSS variables |

Output fields:
| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok"` \| `"error"` | Generation result |
| `framework` | string | The framework used |
| `code` | string | Generated source code |
| `fileExtension` | string | Suggested extension (`.tsx`, `.vue`, `.html`) |
| `imports` | string[] | Required import statements |
| `warnings` | codegenIssue[] | Non-fatal issues |
| `errors` | codegenIssue[] | Fatal issues (code will be empty) |
| `meta` | object | nodeCount, componentCount, unknownComponents |

---

### `design.compose`

- **Input schema**: `packages/mcp-server/src/schemas/design.compose.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/design.compose.output.json`
- **Policy**: designer, maintainer | read-only | timeout 30s | rate 60/min | concurrency 4
- **Purpose**: Generate a complete UiSchema from a natural-language intent description using layout templates and a deterministic component selection engine.

Example input:
```json
{
  "intent": "dashboard with metrics and sidebar navigation",
  "layout": "auto",
  "options": { "validate": true, "topN": 3 }
}
```

Example output:
```json
{
  "status": "ok",
  "layout": "dashboard",
  "schema": { "version": "2026.02", "screens": ["..."] },
  "selections": [
    {
      "slotName": "metrics",
      "intent": "metrics display",
      "selectedComponent": "MetricCard",
      "candidates": [
        { "name": "MetricCard", "confidence": 0.92, "reason": "Direct intent match for metrics" },
        { "name": "StatSummary", "confidence": 0.78, "reason": "Summary statistics display" }
      ]
    }
  ],
  "validation": { "status": "ok", "errors": [], "warnings": [] },
  "warnings": [],
  "meta": { "intentParsed": "dashboard with metrics and sidebar navigation", "layoutDetected": "dashboard", "slotCount": 4, "nodeCount": 8 }
}
```

Input fields:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `intent` | string | Yes | Natural-language description of the desired UI |
| `layout` | `"dashboard"` \| `"form"` \| `"detail"` \| `"list"` \| `"auto"` | No (default `"auto"`) | Layout template. `auto` infers from intent keywords. |
| `preferences.theme` | string | No | Theme token |
| `preferences.metricColumns` | integer 1-12 | No | Dashboard metric columns |
| `preferences.fieldGroups` | integer 1-20 | No | Form field groups |
| `preferences.tabCount` | integer 1-10 | No | Detail tab count |
| `preferences.tabLabels` | string[] | No | Custom tab labels |
| `preferences.componentOverrides` | object | No | Slot-name to component-name overrides |
| `options.validate` | boolean | No (default `true`) | Auto-validate via `repl.validate` |
| `options.topN` | integer 1-10 | No (default `3`) | Component candidates per slot |

Output fields:
| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok"` \| `"error"` | Composition result |
| `layout` | string | Layout template used |
| `schema` | UiSchema | Generated schema |
| `selections` | slotSelection[] | Component selection results per slot |
| `validation` | object | Auto-validation result (`ok` / `invalid` / `skipped`) |
| `warnings` | issue[] | Non-fatal issues |
| `meta` | object | intentParsed, layoutDetected, slotCount, nodeCount |

---

### `map.create`

- **Input schema**: `packages/mcp-server/src/schemas/map.create.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/map.create.output.json`
- **Policy**: designer, maintainer | writes `artifacts/structured-data/component-mappings.json` | timeout 30s | rate 30/min | concurrency 1
- **Purpose**: Create a component-to-trait mapping for an external design system component.

Example input:
```json
{
  "externalSystem": "material",
  "externalComponent": "Button",
  "oodsTraits": ["Clickable", "Themeable"],
  "propMappings": [
    { "externalProp": "variant", "oodsProp": "appearance", "coercion": { "type": "enum-map", "values": { "contained": "primary", "outlined": "secondary", "text": "ghost" } } },
    { "externalProp": "disabled", "oodsProp": "isDisabled" }
  ],
  "confidence": "manual",
  "apply": true
}
```

Example output:
```json
{
  "status": "ok",
  "mapping": {
    "id": "material__Button",
    "externalSystem": "material",
    "externalComponent": "Button",
    "oodsTraits": ["Clickable", "Themeable"],
    "propMappings": ["..."],
    "confidence": "manual",
    "createdAt": "2026-02-28T00:00:00Z"
  },
  "etag": "a1b2c3...",
  "warnings": []
}
```

Input fields:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `externalSystem` | string | Yes | External design system name |
| `externalComponent` | string | Yes | Component name in the external system |
| `oodsTraits` | string[] | Yes | OODS traits this component maps to |
| `propMappings` | array | No | Property translations with optional coercion |
| `propMappings[].coercion.type` | `"enum-map"` \| `"boolean-invert"` \| `"string-template"` \| `"type-cast"` | No | Coercion strategy |
| `confidence` | `"auto"` \| `"manual"` | No (default `"manual"`) | Mapping provenance |
| `apply` | boolean | No | Write to disk when true |

---

### `map.list`

- **Input schema**: `packages/mcp-server/src/schemas/map.list.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/map.list.output.json`
- **Policy**: designer, maintainer | read-only | timeout 30s | rate 60/min | concurrency 4
- **Purpose**: List component-to-trait mappings, optionally filtered by external system.

Example input:
```json
{ "externalSystem": "material" }
```

Example output:
```json
{
  "mappings": [
    { "id": "material__Button", "externalSystem": "material", "externalComponent": "Button", "oodsTraits": ["Clickable", "Themeable"], "..." : "..." }
  ],
  "totalCount": 3,
  "stats": { "mappingCount": 3, "systemCount": 1 },
  "etag": "a1b2c3..."
}
```

---

### `map.resolve`

- **Input schema**: `packages/mcp-server/src/schemas/map.resolve.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/map.resolve.output.json`
- **Policy**: designer, maintainer | read-only | timeout 30s | rate 60/min | concurrency 4
- **Purpose**: Resolve an external component to its OODS trait mapping with flattened prop translations.

Example input:
```json
{ "externalSystem": "material", "externalComponent": "Button" }
```

Example output (found):
```json
{
  "status": "ok",
  "mapping": { "id": "material__Button", "..." : "..." },
  "propTranslations": [
    { "externalProp": "variant", "oodsProp": "appearance", "coercionType": "enum-map", "coercionDetail": { "values": { "contained": "primary", "outlined": "secondary" } } },
    { "externalProp": "disabled", "oodsProp": "isDisabled", "coercionType": null, "coercionDetail": null }
  ]
}
```

Example output (not found):
```json
{
  "status": "not_found",
  "message": "No mapping found for material/TextField"
}
```

---

## On-demand tool contracts (9 tools)

Enable on-demand tools via `MCP_TOOLSET=all` or `MCP_EXTRA_TOOLS=...`.

### `a11y.scan`

- **Input schema**: `packages/mcp-server/src/schemas/a11y.scan.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/generic.output.json`
- **Policy**: designer, maintainer | writes `${BASE}/${DATE}/**` | timeout 120s | rate 12/min | concurrency 1
- **Purpose**: Run WCAG contrast checks against DTCG design tokens. Produces a structured accessibility report.

Example input:
```json
{ "apply": true, "schema": { "version": "2026.02", "screens": ["..."] } }
```

Input fields:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apply` | boolean | No (default `false`) | Write a11y report artifact to disk |
| `schema` | UiSchema | No | Include component inventory in the report |

Notes:
- Loads DTCG token data, resolves alias chains, evaluates 18+ contrast rules.
- Report includes per-rule results (pass/fail with contrast ratio) and aggregate compliance summary.
- When `schema` is provided, the report also inventories which components are affected.

---

### `diag.snapshot`

- **Input schema**: `packages/mcp-server/src/schemas/generic.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/generic.output.json`
- **Policy**: designer, maintainer | writes `${BASE}/${DATE}/**` | timeout 120s | rate 12/min | concurrency 1
- **Purpose**: Emit a diagnostics JSON artifact bundle for the current repo state.

Example input:
```json
{ "apply": true }
```

---

### `reviewKit.create`

- **Input schema**: `packages/mcp-server/src/schemas/generic.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/generic.output.json`
- **Policy**: designer, maintainer | writes `${BASE}/${DATE}/**` | timeout 90s | rate 30/min | concurrency 1
- **Purpose**: Create review-kit bundles with summary, diffs, and specimen files for design review.

Example input:
```json
{ "apply": true }
```

---

### `purity.audit`

- **Input schema**: `packages/mcp-server/src/schemas/generic.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/generic.output.json`
- **Policy**: designer, maintainer | writes `${BASE}/${DATE}/**` | timeout 120s | rate 12/min | concurrency 1
- **Purpose**: Run a purity audit on the design system to detect drift from canonical patterns.

Example input:
```json
{ "apply": true }
```

---

### `vrt.run`

- **Input schema**: `packages/mcp-server/src/schemas/generic.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/generic.output.json`
- **Policy**: designer, maintainer | writes `${BASE}/${DATE}/**` | timeout 120s | rate 12/min | concurrency 1
- **Purpose**: Execute visual regression tests and produce comparison artifacts.

Example input:
```json
{ "apply": true }
```

---

### `billing.reviewKit`

- **Input schema**: `packages/mcp-server/src/schemas/billing.reviewKit.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/generic.output.json`
- **Policy**: designer, maintainer | writes `${BASE}/${DATE}/**` | timeout 120s | rate 20/min | concurrency 1
- **Purpose**: Compare billing provider fixtures and produce a review kit with diffs and specimens.

Example input:
```json
{ "object": "Subscription", "fixtures": ["stripe", "chargebee"], "apply": true }
```

Input fields:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `object` | `"Subscription"` \| `"Invoice"` \| `"Plan"` \| `"Usage"` | Yes | Billing object to compare |
| `fixtures` | string[] | No (default `["stripe", "chargebee"]`) | Provider fixtures to include |
| `apply` | boolean | No (default `false`) | Write artifacts to disk |

---

### `billing.switchFixtures`

- **Input schema**: `packages/mcp-server/src/schemas/billing.switchFixtures.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/generic.output.json`
- **Policy**: designer, maintainer | writes `${BASE}/${DATE}/**` | timeout 90s | rate 20/min | concurrency 1
- **Purpose**: Switch billing provider fixtures and record diffs for Storybook scenarios.

Example input:
```json
{ "provider": "chargebee", "apply": true }
```

Input fields:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | `"stripe"` \| `"chargebee"` | Yes | Target billing provider |
| `apply` | boolean | No (default `false`) | Record switch artifacts |

---

### `release.verify`

- **Input schema**: `packages/mcp-server/src/schemas/release.verify.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/release.verify.output.json`
- **Policy**: **maintainer only** | writes `${BASE}/${DATE}/**` | timeout 180s | rate 6/min | concurrency 1
- **Purpose**: Verify package reproducibility and sanity. Packs each package twice and compares SHA256 hashes.

Example input:
```json
{ "packages": ["@oods/tokens", "@oods/tw-variants"], "apply": true }
```

Input fields:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `packages` | `"@oods/tokens"` \| `"@oods/tw-variants"` \| `"@oods/a11y-tools"` | No | Packages to verify (defaults to all) |
| `fromTag` | string | No | Git tag to diff changelog from |
| `apply` | boolean | No | Write verification artifacts |

Output fields:
| Field | Type | Description |
|-------|------|-------------|
| `results` | array | Per-package result: name, version, identical (bool), sha256, sizeBytes, files |
| `changelogPath` | string | Path to generated changelog |
| `summary` | string | Human-readable summary |

---

### `release.tag`

- **Input schema**: `packages/mcp-server/src/schemas/release.tag.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/release.tag.output.json`
- **Policy**: **maintainer only** | writes `${BASE}/${DATE}/**` | timeout 60s | rate 6/min | concurrency 1
- **Purpose**: Create a git tag for release. Validates tag format and checks for uncommitted changes.

Example input:
```json
{ "tag": "v0.2.0-internal.20260228", "message": "Sprint 52 release", "apply": true }
```

Input fields:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tag` | string | Yes | Tag name (format: `vX.Y.Z-internal.YYYYMMDD`) |
| `message` | string | No | Tag annotation message |
| `apply` | boolean | No | Actually create the tag (false = dry run) |

Output fields:
| Field | Type | Description |
|-------|------|-------------|
| `tag` | string | The tag name |
| `created` | boolean | Whether the tag was created |
| `warnings` | string[] | Issues (e.g., existing tag, uncommitted changes) |

---

## UiSchema DSL (Design Lab)

The Design Lab UiSchema is defined by `packages/mcp-server/src/schemas/repl.ui.schema.json`.

Core shape:
- `version` (string, required): DSL version used by `repl.validate`/`repl.render`.
- `screens` (array, required): each entry is a UI element with `{ id, component, children?, props?, layout?, style?, bindings?, meta? }`.

Patch shape:
- `packages/mcp-server/src/schemas/repl.patch.json` supports:
  - RFC 6902 JSON patch ops (`[{ op, path, value? }, ...]`) where `path` is a JSON pointer
  - node-targeted ops (`{ nodeId, path, value?, op? }`) where `path` is a dotted or slash-separated property path relative to the node

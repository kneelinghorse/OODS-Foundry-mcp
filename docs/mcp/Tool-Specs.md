# MCP Tool Specs (v1.0)

This document is the operator-facing contract surface for the OODS Foundry MCP server: tool names, registration rules, and the expected input/output shapes (backed by the JSON schemas in `packages/mcp-server/src/schemas/`).

For exhaustive per-tool parameter tables across the full live tool surface, also use `docs/api/README.md`.

## Registration + enablement

Auto tools are registered by default (22 at the time of writing). On-demand tools are only registered when enabled (9 at the time of writing).

- Enable every on-demand tool: `MCP_TOOLSET=all`
- Enable a subset: `MCP_EXTRA_TOOLS=a11y.scan,vrt.run`

Registry source of truth: `packages/mcp-server/src/tools/registry.json` (copied to `dist/tools/registry.json` on build).

Removed in v1.0: `design.generate` (it was a stub and is no longer shipped).

## Cross-tool semantics

- `schemaRef` TTL: refs returned by `design.compose`, `viz.compose`, `pipeline`, and `schema.load` expire after 30 minutes. Persist work with `schema.save` before expiry if you need cross-session reuse.
- `apply`: write-capable tools default to dry-run/preview behavior. Set `apply: true` only when you want artifacts written or heavy outputs returned. `repl.render` returns HTML/fragments only when `apply: true`.
- `compact`: `pipeline` defaults to compact render output and returns `tokenCssRef` instead of inlining token CSS. `repl.render` keeps full token CSS by default; opt into compact mode with `output.compact: true`.
- Trait-name formats vary by tool family:
  - `catalog.list` and `map.*` use canonical structured-data trait names such as `Stateful`, `Labelled`, or `Priceable`
  - `object.list` accepts full or suffix-matched namespaced object traits such as `lifecycle/Stateful` or `Stateful`
  - `viz.compose` explicit traits use hyphenated viz IDs such as `mark-bar` and `encoding-position-x`

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

## Auto tool contracts (22 tools)

The expanded narrative sections below cover 11 heavily used auto tools. The remaining 11 default tools are summarized near the end of this section and link to the maintained `docs/api/*` pages.

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
  "bundleIndexPath": "artifacts/current-state/2026-02-24/tokens.build/bundle.json",
  "preview": {
    "summary": "Preview only: would build 4 token artifacts for brand A (dark theme).",
    "notes": [
      "artifact: tokens.dark.json",
      "artifact: tokens.css",
      "artifact: tokens.ts",
      "artifact: tokens.tailwind.json"
    ]
  }
}
```

Notes:
- `apply=true` writes token artifacts under the run directory; `apply=false` is preview-only.
- Preview responses include a summary of expected artifacts when `apply=false`.

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
  "version": "2026-03-06",
  "generatedAt": "2026-03-06T02:51:49Z",
  "etag": "c4bfbbcca95bb631b5a528db5885161196ee357acacaf3de899e43b415be5608",
  "matched": true,
  "payloadIncluded": false,
  "path": "artifacts/structured-data/oods-components-2026-03-06.json",
  "manifestPath": "artifacts/structured-data/manifest.json",
  "sizeBytes": 472491,
  "schemaValidated": true,
  "meta": { "componentCount": 101, "traitCount": 41, "objectCount": 12, "domainCount": 1, "patternCount": 2 }
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

Example input (schemaRef shorthand):
```json
{
  "mode": "full",
  "schemaRef": "compose-abc123"
}
```

Example input (mode=`patch`, node patch):
```json
{
  "mode": "patch",
  "baseTree": { "version": "2026.02", "screens": [ { "id": "screen_home", "component": "Stack", "children": [] } ] },
  "patch": { "nodeId": "screen_home", "path": "component", "value": "Card" }
}
```

Example input (mode=`patch`, JSON Patch array):
```json
{
  "mode": "patch",
  "baseTree": { "version": "2026.02", "screens": [ { "id": "screen_home", "component": "Stack", "children": [] } ] },
  "patch": [
    { "op": "replace", "path": "/screens/0/component", "value": "Card" }
  ]
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
- `schemaRef` can be passed instead of `schema` when using a cached schema from `design.compose`.
- In `patch` mode, `baseTree` is required. Patch payloads accept JSON Patch arrays or node patch objects/arrays. Malformed patch requests return path-level errors with a valid patch example in `hint`.

---

### `repl.render`

- **Input schema**: `packages/mcp-server/src/schemas/repl.render.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/repl.render.output.json`
- **Policy**: designer, maintainer | writes `${BASE}/${DATE}/**` | timeout 30s | rate 60/min | concurrency 4
- **Purpose**: Render UiSchema trees to HTML. Supports document mode (self-contained page) and fragment mode (per-component HTML + CSS map).
- **Preview note**: HTML/fragments payloads are returned only when `apply: true`; otherwise responses are metadata-only previews.

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

Example input (schemaRef shorthand):
```json
{
  "mode": "full",
  "schemaRef": "compose-abc123",
  "apply": true
}
```

Fragment mode:
```json
{
  "mode": "full",
  "apply": true,
  "output": { "format": "fragments" },
  "schema": { "...": "..." }
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
- HTML and fragment payloads are returned only when `apply: true`; otherwise responses are metadata-only previews.
- Fragment mode returns per-component HTML fragments with `cssRefs` for CSS extraction (requires `apply: true`).
- Unknown components in non-strict fragment mode produce per-node errors without blocking sibling rendering.
- `schemaRef` can be passed instead of `schema` when using a cached schema from `design.compose`.
- Patch mode requires both `baseTree` and `patch`.

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
  "preview": { "verbosity": "compact" },
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
- `preview.verbosity="compact"` omits full before/after payloads and specimens, returning summary + hunks only. Default is `full`.

---

### `catalog.list`

- **Input schema**: `packages/mcp-server/src/schemas/catalog.list.input.json`
- **Output schema**: `packages/mcp-server/src/schemas/catalog.list.output.json`
- **Policy**: designer, maintainer | read-only | timeout 30s | rate 60/min | concurrency 4
- **Purpose**: List component catalog entries derived from `artifacts/structured-data` exports.

Example input:
```json
{}
```

Example output (truncated, default summary + pagination):
```json
{
  "detail": "summary",
  "page": 1,
  "pageSize": 25,
  "returnedCount": 25,
  "totalCount": 101,
  "hasMore": true,
  "components": [
    {
      "name": "AddressCollectionPanel",
      "displayName": "AddressCollectionPanel",
      "categories": ["core"],
      "tags": ["address", "delivery", "location", "validation"],
      "contexts": ["detail"],
      "regions": ["detail", "form", "list", "timeline"],
      "traits": ["Addressable"]
    }
  ],
  "generatedAt": "2026-03-06T02:51:49Z",
  "stats": { "componentCount": 101, "traitCount": 41 }
}
```

Notes:
- Unfiltered calls default to `detail: "summary"` with pagination (`pageSize: 25`). Use `page`/`pageSize` to navigate.
- To opt into full detail (props, slots, code references), set `detail: "full"` explicitly. Filtered calls default to full detail for backward compatibility.
- Trait filters use canonical structured-data trait names such as `Stateful`, `Priceable`, or `Addressable`.
- When `trait` yields zero results, responses include `suggestions.traits` with nearest valid trait names (case-insensitive + typo tolerance).

Example input (explicit full detail):
```json
{ "detail": "full", "category": "core" }
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

Example input (schemaRef shorthand):
```json
{
  "schemaRef": "compose-abc123",
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
| `schema` | UiSchema | Yes (unless `schemaRef` provided) | A validated UiSchema tree |
| `schemaRef` | string | No | Cached schema reference from `design.compose` |
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
  "schemaRef": "compose-abc123",
  "schemaRefCreatedAt": "2026-03-04T02:00:00Z",
  "schemaRefExpiresAt": "2026-03-04T02:30:00Z",
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
| `schemaRef` | string | Cached schema reference for reuse in validate/render/code.generate |
| `schemaRefCreatedAt` | string | ISO timestamp when schemaRef was created |
| `schemaRefExpiresAt` | string | ISO timestamp when schemaRef expires |
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
  "oodsTraits": ["Stateful", "Labelled"],
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
    "id": "material-button",
    "externalSystem": "material",
    "externalComponent": "Button",
    "oodsTraits": ["Stateful", "Labelled"],
    "propMappings": ["..."],
    "confidence": "manual",
    "metadata": {
      "createdAt": "2026-02-28T00:00:00Z"
    }
  },
  "etag": "a1b2c3...",
  "applied": true,
  "warnings": []
}
```

Notes:
- When `apply` is `false` (or omitted), the mapping is not persisted and `applied` is `false`. The response includes a dry-run warning.
- When `status` is `"error"`, an `errors` object is returned with `message` + `details` (field-level entries matching `formatValidationErrors()`).
- `oodsTraits` should use canonical structured-data trait names such as `Stateful`, `Labelled`, or `Priceable`. Discover valid values via `structuredData.fetch` or `catalog.list`.

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
    { "id": "material__Button", "externalSystem": "material", "externalComponent": "Button", "oodsTraits": ["Stateful", "Labelled"], "..." : "..." }
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

### Additional auto tools available by default

These tools are part of the default auto-registered surface and have full parameter/output tables under `docs/api/*.md`.

| Tool | Purpose | Key semantics | API doc |
|------|---------|---------------|---------|
| `pipeline` | Compose → validate → render → code generation in one call | Returns `schemaRef`; compact render output is on by default; `save` persists schemas beyond the 30-minute TTL | [pipeline](../api/pipeline.md) |
| `health` | Inspect live server readiness and registry/token/schema-store status | Useful for connection smoke checks and current inventory counts | [health](../api/health.md) |
| `map.update` | Update an existing mapping by id | `updates.oodsTraits` uses canonical structured-data trait names | [map.update](../api/map-update.md) |
| `map.delete` | Delete an existing mapping by id | Removes the mapping record from the shared mapping store | [map.delete](../api/map-delete.md) |
| `schema.save` | Persist a `schemaRef` under a stable name | Use before `schemaRef` expiry; supports tags and author metadata | [schema.save](../api/schema-save.md) |
| `schema.load` | Load a saved schema into a fresh `schemaRef` | Returns a new 30-minute `schemaRef` plus schema metadata | [schema.load](../api/schema-load.md) |
| `schema.list` | List saved schema metadata | Filter by object, context, or tags | [schema.list](../api/schema-list.md) |
| `schema.delete` | Delete a saved schema | Removes the saved schema and index metadata entry | [schema.delete](../api/schema-delete.md) |
| `object.list` | Browse canonical OODS objects | Trait filter accepts `lifecycle/Stateful` or suffix form `Stateful` | [object.list](../api/object-list.md) |
| `object.show` | Show a full object definition with composed traits and view extensions | Optional context filter narrows the view-extension surface | [object.show](../api/object-show.md) |
| `viz.compose` | Compose chart schemas from explicit bindings or object viz traits | Explicit `traits` use viz ids such as `mark-bar` and `encoding-position-x` | [viz.compose](../api/viz-compose.md) |

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

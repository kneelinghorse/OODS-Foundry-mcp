# repl.render

> Render a validated UiSchema into HTML/CSS preview output. Accepts schemaRef from design.compose. Supports document and fragment formats; HTML/fragments are returned only when apply=true (apply=false returns metadata-only preview). Use output.compact=true to omit token CSS (~40% size reduction) and receive a tokenCssRef instead. Note: schemaRef expires after 30 minutes — use schema.save to persist.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dslVersion` | string | No |  | DSL version to use for this request. Defaults to the current version (1.0). |
| `mode` | `full` \| `patch` | No | `"full"` |  |
| `schema` | _ref_ | No |  |  |
| `schemaRef` | string | No |  | Reference to a cached UiSchema returned by design.compose. |
| `patch` | _ref_ | No |  |  |
| `baseTree` | _ref_ | No |  |  |
| `researchContext` | object | No |  | Optional research bundle from Stage1 discovery to influence rendering. |
| `options` | object | No | `{}` |  |
| `options.includeTree` | boolean | No | `true` |  |
| `output` | object | No |  | Optional render output controls. Omitting this object preserves full-document behavior. |
| `output.format` | `document` \| `fragments` | No | `"document"` |  |
| `output.strict` | boolean | No | `false` |  |
| `output.includeCss` | boolean | No | `true` |  |
| `output.compact` | boolean | No | `false` | When true, omit the full token CSS from the response and return a tokenCssRef instead. Reduces response size by ~40%. Default false for repl.render, true for pipeline. |
| `output.depth` | number | No |  | Reserved for v2 fragment-depth controls; currently ignored. |
| `apply` | boolean | No |  |  |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | `ok` \| `error` | Yes |  |
| `mode` | `full` \| `patch` | Yes |  |
| `dslVersion` | string | Yes |  |
| `registryVersion` | string \| null | No |  |
| `errors` | _ref_[] | Yes |  |
| `warnings` | _ref_[] | Yes |  |
| `renderedTree` | _ref_ | No |  |
| `normalizedPatch` | _ref_ | No |  |
| `appliedPatch` | boolean | No |  |
| `preview` | object | No |  |
| `html` | string | No | Standalone HTML5 document generated when apply=true, output.format=document (or omitted), and render validation passes. |
| `tokenCssRef` | string | No | Reference to the token CSS artifact when compact mode is enabled. Use tokens.build to obtain the full CSS. |
| `fragments` | Record<string, object> | No | Fragment payload keyed by canonical node id when output.format=fragments. |
| `css` | Record<string, string> | No | Resolved CSS map keyed by cssRef identifier. |
| `output` | object | No | Echoes normalized output controls used by the renderer. |
| `meta` | object | No |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |
| `OODS-V006` | Unknown component (no renderer) |
| `OODS-N002` | Schema ref not found or expired |

## Example Request

```json
{}
```

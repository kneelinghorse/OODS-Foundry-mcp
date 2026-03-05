# repl.render

> Render a validated UiSchema into HTML/CSS preview output. Accepts schemaRef from design.compose. Supports document and fragment formats; HTML/fragments are returned only when apply=true (apply=false returns metadata-only preview).

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dslVersion` | string | No |  | DSL version to use for this request. Defaults to the current version (1.0). |
| `mode` | `full` \| `patch` | Yes | `"full"` |  |
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
{
  "mode": "full"
}
```

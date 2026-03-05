# code.generate

> Generate framework-specific code (React, Vue, or HTML) from a validated UiSchema tree. Accepts schemaRef from design.compose. Supports TypeScript and token-based styling. Note: schemaRef expires after 30 minutes — use schema.save to persist.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dslVersion` | string | No |  | DSL version to use for this request. Defaults to the current version (1.0). |
| `schema` | _ref_ | No |  | A validated UiSchema tree to generate code from. |
| `schemaRef` | string | No |  | Reference to a cached UiSchema returned by design.compose. |
| `framework` | `react` \| `vue` \| `html` | Yes |  | Target framework for code generation. HTML delegates to existing repl.render document mode. |
| `options` | object | No | `{}` |  |
| `options.typescript` | boolean | No | `true` | When true, emit TypeScript prop types (React) or typed defineProps (Vue). Ignored for HTML. |
| `options.styling` | `inline` \| `tokens` \| `tailwind` | No | `"tokens"` | Styling strategy: inline style objects, design-token CSS variables, or Tailwind utility classes. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | `ok` \| `error` | Yes | Whether code generation succeeded. |
| `framework` | `react` \| `vue` \| `html` | Yes | The target framework that was used. |
| `code` | string | Yes | The generated source code. Empty string on error. |
| `fileExtension` | string | Yes | Suggested file extension including the dot (e.g., '.tsx', '.vue', '.html'). |
| `imports` | string[] | Yes | Import statements or package names required by the generated code. |
| `warnings` | _ref_[] | Yes | Non-fatal issues encountered during generation. |
| `errors` | _ref_[] | No | Fatal issues that prevented code generation. |
| `meta` | object | No |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |
| `OODS-V005` | Unknown framework |
| `OODS-V006` | Unknown component (no emitter) |
| `OODS-N002` | Schema ref not found or expired |

## Example Request

```json
{
  "framework": "react"
}
```

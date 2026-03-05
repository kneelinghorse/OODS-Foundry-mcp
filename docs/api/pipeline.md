# pipeline

> Execute the full design pipeline (compose -> validate -> render -> codegen) in a single call. Supports optional validation/render skipping, accessibility checks, and schema persistence.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dslVersion` | string | No |  | DSL version to use for this request. Defaults to the current version (1.0). |
| `object` | string | No |  | Object name from the OODS registry (e.g., Subscription, User). |
| `intent` | string | No |  | Natural-language description of the desired UI. |
| `context` | `detail` \| `list` \| `form` \| `timeline` \| `card` \| `inline` | No |  | View context for object-aware composition. |
| `layout` | `dashboard` \| `form` \| `detail` \| `list` \| `auto` | No |  | Layout template to use. |
| `framework` | `react` \| `vue` \| `html` | No |  | Target framework for code generation. |
| `styling` | `inline` \| `tokens` \| `tailwind` | No |  | Styling strategy for code generation. |
| `save` | any | No |  | Optional schema save config. String for name-only, or { name, tags } for full control. |
| `options` | object | No |  |  |
| `options.skipValidation` | boolean | No |  | Skip the validate step (default false). |
| `options.skipRender` | boolean | No |  | Skip the render step (default false). |
| `options.checkA11y` | boolean | No |  | Enable a11y contrast checks in validate (default false). |
| `options.renderApply` | boolean | No |  | Render with apply=true to include HTML output (default true). |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `schemaRef` | string | No | Schema reference returned by compose, reusable across tools. |
| `compose` | object | Yes |  |
| `validation` | object | No |  |
| `render` | object | No |  |
| `code` | object | No |  |
| `saved` | object | No |  |
| `pipeline` | object | Yes |  |
| `error` | object | No |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{}
```

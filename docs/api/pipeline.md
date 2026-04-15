# pipeline

> Execute the full design pipeline (compose -> validate -> render -> codegen) in a single call. Defaults to compact render mode (token CSS omitted, ~40% smaller). Supports optional validation/render skipping, accessibility checks, and schema persistence via save parameter. Returns schemaRefCreatedAt/schemaRefExpiresAt (default TTL: 30 minutes). Use save to persist the schema.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dslVersion` | string | No |  | DSL version to use for this request. Defaults to the current version (1.0). |
| `object` | string | No |  | Object name from the OODS registry (e.g., Subscription, User). |
| `intent` | string | No |  | Natural-language description of the desired UI. |
| `context` | `detail` \| `list` \| `form` \| `timeline` \| `card` \| `inline` | No |  | View context for object-aware composition. |
| `layout` | `dashboard` \| `form` \| `detail` \| `list` \| `card` \| `timeline` \| `auto` | No |  | Layout template to use. |
| `preferences` | object | No |  |  |
| `preferences.theme` | string | No |  | Theme token (e.g., 'light', 'dark'). |
| `preferences.metricColumns` | integer | No |  | Number of metric columns for dashboard layout. |
| `preferences.fieldGroups` | integer | No |  | Number of field groups for form layout. |
| `preferences.tabCount` | integer | No |  | Number of tabs for detail layout. |
| `preferences.tabLabels` | string[] | No |  | Custom tab labels for detail layout. |
| `preferences.componentOverrides` | Record<string, string> | No |  | Slot-name to component-name overrides (e.g., { 'items': 'Table' }). |
| `actionMappings` | object[] | No |  | Sprint 88: Stage1 BridgeSummary action_mappings, flat verb-keyed entries. See docs/integration/stage1-oods-contract.md §2c. |
| `framework` | `react` \| `vue` \| `html` | No |  | Target framework for code generation. |
| `styling` | `inline` \| `tokens` \| `tailwind` | No |  | Styling strategy for code generation. |
| `save` | any | No |  | Optional schema save config. String for name-only, or { name, tags } for full control. |
| `options` | object | No |  |  |
| `options.skipValidation` | boolean | No |  | Skip the validate step (default false). |
| `options.skipRender` | boolean | No |  | Skip the render step (default false). |
| `options.checkA11y` | boolean | No |  | Enable a11y contrast checks in validate (default false). |
| `options.renderApply` | boolean | No |  | Render with apply=true to include HTML output (default true). |
| `options.compact` | boolean | No |  | When true (default), omit token CSS from render output and return tokenCssRef instead. Reduces response size by ~40%. |
| `options.typescript` | boolean | No |  | Alias: enable TypeScript output in code generation. |
| `options.styling` | `inline` \| `tokens` \| `tailwind` | No |  | Alias: styling strategy. Overridden by top-level styling if both provided. |
| `options.framework` | `react` \| `vue` \| `html` | No |  | Alias: target framework. Overridden by top-level framework if both provided. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `schemaRef` | string | No | Schema reference returned by compose, reusable across tools. |
| `schemaRefCreatedAt` | string | No | ISO timestamp when the schemaRef was created. |
| `schemaRefExpiresAt` | string | No | ISO timestamp when the schemaRef expires. Use schema.save to persist before expiry. |
| `schemaRefTtlWarning` | object | No | Proactive warning when schemaRef TTL is approaching expiration (< 5 minutes remaining). |
| `compose` | object | Yes |  |
| `validation` | object | No |  |
| `render` | object | No |  |
| `code` | object | No |  |
| `saved` | object | No |  |
| `summary` | string | No | One-line natural language description of what was generated. |
| `metrics` | object | No | Quality metrics for the pipeline output. |
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

# viz.compose

> Compose a visualization schema from chart type, data bindings, and/or object viz traits. Returns schemaRef for pipeline reuse. schemaRef includes createdAt/expiresAt (default TTL: 30 minutes). Supports bar, line, area, and point chart types with axis, color, and size encodings.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dslVersion` | string | No |  | DSL version to use for this request. Defaults to the current version (1.0). |
| `object` | string | Yes |  | Object name from the OODS registry. When provided, viz traits are resolved automatically to determine chart type and encodings. |
| `traits` | string[] | Yes |  | Explicit viz trait names (e.g., 'mark-bar', 'encoding-position-x'). Used when composing without an object. |
| `chartType` | `bar` \| `line` \| `area` \| `point` \| `scatter` \| `heatmap` | Yes |  | Chart type to compose. Maps to mark traits: bar→mark-bar, line→mark-line, area→mark-area, point→mark-point, scatter→mark-scatter, heatmap→mark-heatmap. |
| `dataBindings` | object | No |  |  |
| `dataBindings.x` | string | No |  | Field name for the x-axis encoding. |
| `dataBindings.y` | string | No |  | Field name for the y-axis encoding. |
| `dataBindings.color` | string | No |  | Field name for color encoding. |
| `dataBindings.size` | string | No |  | Field name for size encoding. |
| `dataBindings.opacity` | string | No |  | Field name for opacity encoding. |
| `dataBindings.shape` | string | No |  | Field name for shape encoding. |
| `data` | object | No |  | Alias for dataBindings. Maps field names to encoding channels. |
| `data.x` | string | No |  | Field name for the x-axis encoding. |
| `data.y` | string | No |  | Field name for the y-axis encoding. |
| `data.color` | string | No |  | Field name for color encoding. |
| `data.size` | string | No |  | Field name for size encoding. |
| `data.opacity` | string | No |  | Field name for opacity encoding. |
| `data.shape` | string | No |  | Field name for shape encoding. |
| `theme` | string | No |  | Theme token (e.g., 'light', 'dark'). |
| `options` | object | No |  |  |
| `options.validate` | boolean | No | `true` | Auto-validate the generated schema. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | `ok` \| `error` | Yes | Whether the composition succeeded. |
| `chartType` | string | Yes | Resolved chart type (bar, line, area, point, scatter, heatmap, or empty on error). |
| `schema` | object | Yes | The composed UiSchema tree with viz components. |
| `schemaRef` | string | No | Temporary schema reference for pipeline reuse in validate/render/codegen. |
| `schemaRefCreatedAt` | string | No | ISO timestamp when the schemaRef was created. |
| `schemaRefExpiresAt` | string | No | ISO timestamp when the schemaRef expires. |
| `slots` | _ref_[] | Yes | Slot assignments mapping viz components to chart regions. |
| `warnings` | _ref_[] | Yes | Non-fatal issues encountered during composition. |
| `errors` | _ref_[] | No | Fatal errors (present when status is 'error'). |
| `meta` | object | No |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |
| `OODS-V006` | Unknown component during slot selection |
| `OODS-N001` | Object not found in registry |

## Example Request

```json
{
  "chartType": "bar"
}
```

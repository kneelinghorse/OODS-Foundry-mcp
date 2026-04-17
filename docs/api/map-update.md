# map.update

> Update an existing component-to-trait mapping by ID. Supports changing traits, property mappings, confidence, and notes.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes |  | Mapping ID to update (e.g., 'material-button'). |
| `updates` | object | Yes |  | Fields to update. Only provided fields are changed. |
| `updates.oodsTraits` | string[] | No |  | Replace OODS trait list. |
| `updates.confidence` | `auto` \| `manual` | No |  | Update confidence level. |
| `updates.propMappings` | object[] | No |  | Replace property mappings. |
| `updates.notes` | string | No |  | Update notes in metadata. |
| `updates.projection_variants` | object[] | No |  | Replace Stage1 v1.5.0 cross-surface projection variants. Pass an empty array to clear; omit to leave unchanged. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | `ok` \| `error` | Yes |  |
| `mapping` | object | No | The updated mapping record (present when status=ok). |
| `etag` | string | No | SHA256 etag of the mappings file after update. |
| `changes` | string[] | No | List of fields that were changed. |
| `message` | string | No | Error or informational message. |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |
| `OODS-N004` | Mapping not found |

## Example Request

```json
{
  "id": "<id>",
  "updates": {}
}
```

# map.delete

> Delete a component-to-trait mapping by ID.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes |  | Mapping ID to delete (e.g., 'material-button'). |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | `ok` \| `error` | Yes |  |
| `deleted` | object | No | Summary of the deleted mapping. |
| `etag` | string | No | SHA256 etag of the mappings file after deletion. |
| `message` | string | No | Error message when status=error. |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |
| `OODS-N004` | Mapping not found |

## Example Request

```json
{
  "id": "<id>"
}
```

# map.list

> List all component-to-trait mappings. Optionally filter by external design system name.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `externalSystem` | string | No |  | Filter mappings to a specific external system (e.g., 'material'). |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `mappings` | object[] | Yes | Matching mapping records. |
| `totalCount` | integer | Yes | Number of mappings returned. |
| `stats` | object | Yes |  |
| `etag` | string | No | Current ETag of the mappings file. |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{}
```

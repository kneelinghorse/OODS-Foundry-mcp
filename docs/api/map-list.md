# map.list

> List component-to-trait mappings. Optionally filter by external system name, or paginate with cursor and limit. Omitting both cursor and limit preserves the legacy full-list response.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `externalSystem` | string | No |  | Filter mappings to a specific external system (e.g., 'material'). |
| `cursor` | string | No |  | Pagination cursor. Use the previous page's nextCursor to continue. When cursor or limit is provided, pagination defaults to 100 items per page. |
| `limit` | integer | No |  | Page size for pagination. Omitting both cursor and limit preserves the legacy full-list response. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `mappings` | object[] | Yes | Matching mapping records. |
| `totalCount` | integer | Yes | Number of mappings returned. |
| `stats` | object | Yes |  |
| `etag` | string | Yes | Current ETag of the mappings file. |
| `nextCursor` | string | No | Pagination cursor for the next page when additional mappings remain. |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{}
```

# registry.snapshot

> Return the full registry state in one call: maps, traits, objects, etag, and generatedAt. Intended for reconciliation consumers that would otherwise need map.list plus N× map.resolve.

**Registration:** auto

## Input Parameters

_No parameters._

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `maps` | object[] | Yes |  |
| `traits` | Record<string, _ref_> | Yes |  |
| `objects` | Record<string, _ref_> | Yes |  |
| `etag` | string | Yes |  |
| `generatedAt` | string | Yes |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{}
```

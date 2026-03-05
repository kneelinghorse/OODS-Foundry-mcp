# object.show

> Show a full OODS object definition, including composed trait schema and view extensions.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | Yes |  | Object name to look up (e.g. 'User', 'Product', 'Invoice') |
| `context` | string | No |  | Optional: filter view_extensions to a single context (e.g. 'detail', 'list', 'form', 'timeline', 'card', 'inline') |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `name` | string | Yes |  |
| `version` | string | Yes |  |
| `domain` | string | Yes |  |
| `description` | string | Yes |  |
| `tags` | string[] | Yes |  |
| `maturity` | string \| null | Yes |  |
| `traits` | object[] | Yes |  |
| `schema` | Record<string, object> | Yes |  |
| `semantics` | Record<string, object> | Yes |  |
| `viewExtensions` | Record<string, object[]> | Yes |  |
| `tokens` | object | Yes |  |
| `warnings` | string[] | Yes |  |
| `filePath` | string | Yes |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |
| `OODS-N001` | Object not found in registry |

## Example Request

```json
{
  "name": "<name>"
}
```

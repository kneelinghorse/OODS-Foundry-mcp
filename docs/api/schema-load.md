# schema.load

> Load a previously saved schema by name and return a reusable schemaRef plus schema metadata for validate/render/code generation.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | Yes |  | Saved schema name in slug format. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `schemaRef` | string | Yes |  |
| `name` | string | Yes |  |
| `version` | integer | Yes |  |
| `object` | string | No |  |
| `context` | string | No |  |
| `author` | string | No |  |
| `createdAt` | string | Yes |  |
| `updatedAt` | string | Yes |  |
| `tags` | string[] | Yes |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |
| `OODS-N003` | Saved schema not found |

## Example Request

```json
{
  "name": "<name>"
}
```

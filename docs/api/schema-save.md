# schema.save

> Persist a composed UiSchema by name from schemaRef. Stores schema metadata (name, version, object/context, tags, timestamps) for reuse across sessions. Use this to persist schemas beyond the 30-minute schemaRef TTL.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | Yes |  | Saved schema name in slug format (letters, numbers, hyphens, underscores). |
| `schemaRef` | string | Yes |  | Reference to an in-memory schema produced by design.compose. |
| `tags` | string[] | No |  | Optional tags for filtering and discovery. |
| `author` | string | No |  | Optional author metadata. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
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
| `OODS-V004` | Invalid slug format for schema name |
| `OODS-N002` | Schema ref not found or expired |

## Example Request

```json
{
  "name": "<name>",
  "schemaRef": "<schemaRef>"
}
```

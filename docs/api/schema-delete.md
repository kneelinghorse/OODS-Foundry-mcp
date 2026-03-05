# schema.delete

> Delete a saved schema by name and remove it from schema index metadata.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | Yes |  |  |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `deleted` | any | Yes |  |
| `schema` | object | Yes |  |

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

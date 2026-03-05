# map.resolve

> Resolve an external component to its OODS trait mapping with property translations.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `externalSystem` | string | Yes |  | External design system name (e.g., 'material'). |
| `externalComponent` | string | Yes |  | Component name in the external system (e.g., 'Button'). |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | `ok` \| `not_found` | Yes |  |
| `mapping` | object | No | The resolved mapping record (present when status=ok). |
| `propTranslations` | object[] | No | Flattened prop translations with coercion details. |
| `message` | string | No | Explanation when status=not_found. |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |
| `OODS-N004` | Mapping not found |

## Example Request

```json
{
  "externalSystem": "<externalSystem>",
  "externalComponent": "<externalComponent>"
}
```

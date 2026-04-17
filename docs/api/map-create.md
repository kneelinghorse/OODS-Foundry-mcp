# map.create

> Create a component-to-trait mapping between an external design system and OODS. Parameters: externalSystem, externalComponent, oodsTraits, propMappings, confidence, metadata (object with optional author and notes fields). Use apply=true to persist (default: dry-run, returns preview only).

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `apply` | boolean | No | `false` | When true, write changes to disk. |
| `externalSystem` | string | Yes |  | External design system name (e.g., 'material', 'ant-design', 'chakra'). |
| `externalComponent` | string | Yes |  | Component name in the external system (e.g., 'Button', 'TextField'). |
| `oodsTraits` | string[] | Yes |  | OODS trait names this component maps to. |
| `propMappings` | object[] | No |  | Property translations from external to OODS prop names. |
| `confidence` | `auto` \| `manual` | No | `"manual"` | 'auto' for machine-generated, 'manual' for human-curated. |
| `metadata` | object | No |  |  |
| `metadata.author` | string | No |  |  |
| `metadata.notes` | string | No |  |  |
| `projection_variants` | object[] | No |  | Stage1 v1.5.0 cross-surface identity variants. Each element describes one surface-specific projection of this component mapping (desktop/mobile/modal/sidebar). |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | `ok` \| `error` | Yes |  |
| `mapping` | object | Yes | The created mapping record. |
| `etag` | string | Yes | SHA256 ETag of the updated mappings file. |
| `applied` | boolean | No | Whether the mapping was persisted to disk. |
| `warnings` | string[] | No | Non-fatal warnings (e.g., unknown traits). |
| `errors` | object | No | Agent-friendly error details following formatValidationErrors(). |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |
| `OODS-V001` | Invalid mapping definition |

## Example Request

```json
{
  "externalSystem": "<externalSystem>",
  "externalComponent": "<externalComponent>",
  "oodsTraits": []
}
```

# brand.apply

> Apply brand token overlays using alias or RFC 6902 patch strategy. Requires a delta object. Use apply=true to write changes to disk.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `brand` | `A` | No | `"A"` | Target brand identifier. |
| `delta` | any | Yes |  | Alias changes (object) or RFC 6902 patch array when strategy=patch. |
| `strategy` | `alias` \| `patch` | No | `"alias"` | Alias strategy rewrites token values; patch applies RFC 6902 operations. |
| `preview` | object | No |  | Preview response controls (apply=false). |
| `preview.verbosity` | `full` \| `compact` | No | `"full"` | full includes structured before/after payloads; compact returns summary + hunks only. |
| `apply` | boolean | No | `false` |  |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `artifacts` | string[] | Yes |  |
| `diagnosticsPath` | string | No |  |
| `transcriptPath` | string | Yes |  |
| `bundleIndexPath` | string | Yes |  |
| `preview` | object | No |  |
| `artifactsDetail` | _ref_[] | No |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{}
```

# structuredData.fetch

> Fetch structured data exports (components, tokens, or manifest). Supports ETag caching, version pinning, and version listing.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dataset` | `components` \| `tokens` \| `manifest` | Yes |  | Structured dataset to return. |
| `ifNoneMatch` | string | No |  | Return matched=true without payload when the ETag matches. |
| `includePayload` | boolean | No | `true` | When false, omit payload even if no ETag match occurs. |
| `version` | string | No |  | Request a specific date-stamped version (e.g., '2026-02-24'). Omit for latest. |
| `listVersions` | boolean | No | `false` | When true, return available version dates instead of payload. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `dataset` | `components` \| `tokens` \| `manifest` | Yes | Dataset that was requested. |
| `version` | string \| null | No | Version tag (usually the YYYY-MM-DD stamp from the manifest). |
| `generatedAt` | string \| null | No | Timestamp recorded in the payload. |
| `etag` | string | Yes | Stable hash of the payload (generatedAt excluded). |
| `matched` | boolean | Yes | True when ifNoneMatch matched the current ETag and payload was skipped. |
| `payloadIncluded` | boolean | Yes | True when the payload field is returned. |
| `path` | string | Yes | Resolved path to the dataset on disk. |
| `manifestPath` | string \| null | No | Manifest path when available. |
| `sizeBytes` | integer | Yes | File size of the dataset. |
| `schemaValidated` | boolean | Yes | True when the payload was validated against a schema. |
| `validationErrors` | string[] | No | Optional validation error messages. |
| `warnings` | string[] | No | Non-fatal warnings encountered during resolution. |
| `meta` | object | No | Lightweight summary for the payload. |
| `payload` | object | No | Payload contents when payloadIncluded=true. |
| `availableVersions` | string[] | No | Available version dates when listVersions=true. |
| `requestedVersion` | string \| null | No | The version that was requested (null if latest). |
| `resolvedVersion` | string \| null | No | The version that was actually resolved (may differ from requested if nearest match used). |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{
  "dataset": "components"
}
```

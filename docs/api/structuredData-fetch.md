# structuredData.fetch

> Fetch structured data exports (components, tokens, or manifest) or Stage1 v1.5.0 rollup artifacts (identity_graph, capability_rollup, object_rollup) via kind+runPath. Supports ETag caching, version pinning, and version listing in dataset mode; schema_version validation in rollup mode.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dataset` | `components` \| `tokens` \| `manifest` | No |  | Local structured dataset to return (components/tokens/manifest). Mutually exclusive with kind+runPath. |
| `kind` | `identity_graph` \| `capability_rollup` \| `object_rollup` | No |  | Stage1 v1.5.0 rollup artifact kind to read from runPath. Requires runPath; mutually exclusive with dataset. |
| `runPath` | string | No |  | Filesystem path to a Stage1 run directory or its artifacts/ subdirectory. Required when kind is set. |
| `ifNoneMatch` | string | No |  | Return matched=true without payload when the ETag matches. |
| `includePayload` | boolean | No | `true` | When false, omit payload even if no ETag match occurs. |
| `version` | string | No |  | Request a specific date-stamped version (e.g., '2026-02-24'). Omit for latest. Applies to dataset mode only. |
| `listVersions` | boolean | No | `false` | When true, return available version dates instead of payload. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `dataset` | `components` \| `tokens` \| `manifest` | No | Dataset that was requested (dataset mode only). |
| `kind` | `identity_graph` \| `capability_rollup` \| `object_rollup` | No | Stage1 rollup kind that was requested (kind mode only). |
| `schemaVersion` | string | No | Stage1 artifact schema_version (kind mode only). |
| `runId` | string | No | Stage1 run_id extracted from the artifact (kind mode only). |
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
{}
```

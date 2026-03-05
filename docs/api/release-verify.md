# release.verify

> Verify release readiness for specified packages. Checks changelogs, versions, and build artifacts.

**Registration:** on-demand

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `apply` | boolean | No |  |  |
| `packages` | `@oods/tokens` \| `@oods/tw-variants` \| `@oods/a11y-tools`[] | No |  |  |
| `fromTag` | string | No |  |  |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `artifacts` | string[] | Yes |  |
| `diagnosticsPath` | string | No |  |
| `transcriptPath` | string | Yes |  |
| `bundleIndexPath` | string | Yes |  |
| `results` | object[] | Yes |  |
| `changelogPath` | string | Yes |  |
| `summary` | string | Yes |  |
| `warnings` | string[] | No |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{}
```

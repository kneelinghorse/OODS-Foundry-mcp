# map.apply

> Apply a Stage1 reconciliation_report to the mapping registry. Accepts inline report or reportPath, defaults to apply=false dry-run, routes sub-threshold candidates to queued via minConfidence, and returns applied/skipped/queued/conflicted buckets plus etag and optional conflictArtifactPath.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `apply` | boolean | No | `false` | When true, persist registry mutations. Defaults to dry-run. |
| `minConfidence` | number | No | `0.75` | Candidates below this threshold are routed to queued instead of being applied. |
| `reportPath` | string | No |  | Filesystem path to a reconciliation_report.json artifact. |
| `report` | _ref_ | No |  |  |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `applied` | _ref_[] | Yes |  |
| `skipped` | _ref_[] | Yes |  |
| `queued` | _ref_[] | Yes |  |
| `conflicted` | _ref_[] | Yes |  |
| `errors` | _ref_[] | Yes |  |
| `diff` | _ref_ | Yes |  |
| `conflictArtifactPath` | string | No |  |
| `etag` | string | Yes |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{}
```

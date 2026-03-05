# health

> Check MCP server readiness and subsystem status, including registry counts, token artifact availability, and schema store state.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `includeChangelog` | boolean | No | `false` | When true, include DSL version changelog in the response. |
| `sinceVersion` | string | No |  | When provided with includeChangelog, only return changelog entries since this version. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | `ok` \| `degraded` | Yes |  |
| `server` | object | Yes |  |
| `registry` | object | Yes |  |
| `tokens` | object | Yes |  |
| `schemas` | object | Yes |  |
| `latency` | integer | Yes |  |
| `warnings` | string[] | No |  |
| `dslVersion` | string | No | Current DSL version of this server. |
| `changelog` | object[] | No | DSL version changelog entries, included when requested via includeChangelog input. |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{}
```

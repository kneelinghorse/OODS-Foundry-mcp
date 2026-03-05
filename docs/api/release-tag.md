# release.tag

> Create a release tag in the repository. Requires a tag name; optionally include a message.

**Registration:** on-demand

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `apply` | boolean | No |  |  |
| `tag` | string | Yes |  |  |
| `message` | string \| null | No |  |  |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `artifacts` | string[] | Yes |  |
| `transcriptPath` | string | Yes |  |
| `bundleIndexPath` | string | Yes |  |
| `tag` | string | Yes |  |
| `created` | boolean | Yes |  |
| `warnings` | string[] | No |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{
  "tag": "<tag>"
}
```

# billing.switchFixtures

> Switch the active billing fixture provider for Storybook scenarios. Use apply=true to record the switch (default: dry-run).

**Registration:** on-demand

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `apply` | boolean | No | `false` | When true, records the fixture switch results as artifacts. |
| `provider` | `stripe` \| `chargebee` | Yes | `"stripe"` | Billing fixture provider to activate for Storybook scenarios. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | `ok` \| `error` \| `invalid` | No |  |
| `notes` | string | No |  |
| `logs` | string[] | No |  |
| `artifacts` | any[] | Yes |  |
| `diagnosticsPath` | string | No |  |
| `transcriptPath` | string | Yes |  |
| `bundleIndexPath` | string | Yes |  |
| `structuredData` | object | No |  |
| `artifactsDetail` | object[] | No |  |
| `preview` | object | No |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{
  "provider": "stripe"
}
```

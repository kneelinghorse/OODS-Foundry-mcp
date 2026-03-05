# billing.reviewKit

> Generate a billing review kit comparing provider fixtures (Stripe, Chargebee) for a billing object.

**Registration:** on-demand

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `apply` | boolean | No | `false` | When true, writes review kit artifacts to the billing bundle directory. |
| `object` | `Subscription` \| `Invoice` \| `Plan` \| `Usage` | Yes | `"Subscription"` | Billing object to include in the review kit bundle. |
| `fixtures` | `stripe` \| `chargebee`[] | No | `["stripe","chargebee"]` | Provider fixtures to compare in the review kit. |

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
  "object": "Subscription"
}
```

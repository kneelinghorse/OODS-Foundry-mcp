# object.list

> List OODS objects from the registry with optional filtering by domain, maturity, or trait.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `domain` | string | No |  | Filter to objects in a specific domain (e.g. 'core.identity', 'saas.billing') |
| `maturity` | `draft` \| `alpha` \| `beta` \| `stable` | No |  | Filter by metadata maturity level |
| `trait` | string | No |  | Filter to objects composing a given trait (e.g. 'Priceable', 'lifecycle/Stateful') |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `objects` | object[] | Yes |  |
| `totalCount` | integer | Yes |  |
| `filters` | object | Yes |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{}
```

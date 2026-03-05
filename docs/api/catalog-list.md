# catalog.list

> List available OODS components from the design system catalog. Filter by category, trait, or rendering context.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `category` | string | No |  | Filter components by category (e.g., 'core', 'data') |
| `trait` | string | No |  | Filter components by trait (e.g., 'Editable', 'Searchable') |
| `context` | string | No |  | Filter components by context (e.g., 'detail', 'list') |
| `status` | `stable` \| `beta` \| `planned` | No |  | Filter by component status. 'stable' = has renderer, 'planned' = not yet implemented. |
| `detail` | `summary` \| `full` | No |  | Response detail level. Defaults to summary for unfiltered calls, full when filters are provided. |
| `page` | integer | No |  | 1-based page index for pagination. |
| `pageSize` | integer | No |  | Number of components per page. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `components` | object[] | Yes | Array of component catalog entries |
| `totalCount` | integer | Yes | Total number of components that match the filters (before pagination). |
| `returnedCount` | integer | Yes | Number of components returned in this page. |
| `page` | integer | Yes | 1-based page index used for pagination. |
| `pageSize` | integer | Yes | Page size used for pagination. 0 when there are no results. |
| `hasMore` | boolean | Yes | Whether more components are available after this page. |
| `detail` | `summary` \| `full` | Yes | Detail level applied to component entries. |
| `generatedAt` | string | Yes | ISO timestamp when catalog was generated |
| `stats` | object | Yes |  |
| `suggestions` | object | No | Suggested filter values when a query returns zero results. |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |

## Example Request

```json
{}
```

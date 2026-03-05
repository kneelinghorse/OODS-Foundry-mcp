# repl.validate

> Validate a UiSchema tree or patch against the Design Lab schema. Accepts schemaRef from design.compose. Returns validation errors, warnings, and optionally a normalized tree.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dslVersion` | string | No |  | DSL version to use for this request. Defaults to the current version (1.0). |
| `mode` | `full` \| `patch` | No | `"full"` |  |
| `schema` | _ref_ | No |  |  |
| `schemaRef` | string | No |  | Reference to a cached UiSchema returned by design.compose. |
| `patch` | _ref_ | No |  | Required when mode='patch'. Accepts JSON Patch array or node patch object(s). |
| `baseTree` | _ref_ | No |  | Required when mode='patch' to provide the base UiSchema to patch. |
| `options` | object | No | `{}` |  |
| `options.includeNormalized` | boolean | No | `true` |  |
| `options.checkComponents` | boolean | No | `true` |  |
| `options.checkA11y` | boolean | No | `false` | When true, run WCAG contrast checks against design tokens and surface failures as A11Y_CONTRAST warnings. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | `ok` \| `invalid` | Yes |  |
| `mode` | `full` \| `patch` | Yes |  |
| `dslVersion` | string | Yes |  |
| `registryVersion` | string \| null | No |  |
| `errors` | _ref_[] | Yes |  |
| `warnings` | _ref_[] | Yes |  |
| `normalizedTree` | _ref_ | No |  |
| `normalizedPatch` | _ref_ | No |  |
| `appliedPatch` | boolean | No |  |
| `meta` | object | No |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |
| `OODS-V007` | DSL schema validation failed |
| `OODS-V009` | Missing schema |
| `OODS-N002` | Schema ref not found or expired |

## Example Request

```json
{}
```

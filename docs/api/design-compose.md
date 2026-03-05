# design.compose

> Compose a complete UiSchema from a natural-language intent description. Returns schemaRef for reuse in validate/render/code.generate. schemaRef includes createdAt/expiresAt timestamps (default TTL: 30 minutes). Use schema.save to persist beyond TTL.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dslVersion` | string | No |  | DSL version to use for this request. Defaults to the current version (1.0). Controls feature availability and deprecation behavior. |
| `intent` | string | Yes |  | Natural-language description of the desired UI (e.g., 'dashboard with metrics and sidebar', 'user registration form'). |
| `object` | string | Yes |  | Object name from the OODS registry (e.g., 'Subscription', 'User'). When provided, composition uses trait-driven component placement via view_extensions. |
| `context` | `detail` \| `list` \| `form` \| `timeline` \| `card` \| `inline` | No |  | View context for object-aware composition. Determines which view_extensions are applied. When object is provided without layout, context infers the layout (detail→detail, list→list, form→form). |
| `layout` | `dashboard` \| `form` \| `detail` \| `list` \| `auto` | No | `"auto"` | Layout template to use. 'auto' infers the best template from intent keywords. |
| `preferences` | object | No |  |  |
| `preferences.theme` | string | No |  | Theme token (e.g., 'light', 'dark'). |
| `preferences.metricColumns` | integer | No |  | Number of metric columns for dashboard layout. |
| `preferences.fieldGroups` | integer | No |  | Number of field groups for form layout. |
| `preferences.tabCount` | integer | No |  | Number of tabs for detail layout. |
| `preferences.tabLabels` | string[] | No |  | Custom tab labels for detail layout. |
| `preferences.componentOverrides` | Record<string, string> | No |  | Slot-name → component-name overrides (e.g., { 'items': 'Table' }). |
| `options` | object | No |  |  |
| `options.validate` | boolean | No | `true` | Auto-validate the generated schema via repl.validate. |
| `options.topN` | integer | No | `3` | Number of component candidates to return per slot. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | `ok` \| `error` | Yes | Whether composition succeeded. |
| `layout` | string | Yes | The layout template that was used. |
| `schema` | _ref_ | Yes | The generated UiSchema (with slot placeholders intact for agent customization). |
| `schemaRef` | string | No | Server-managed reference to the generated schema for reuse in validate/render/code.generate. |
| `schemaRefCreatedAt` | string | No | ISO timestamp when the schemaRef was created. |
| `schemaRefExpiresAt` | string | No | ISO timestamp when the schemaRef expires. |
| `selections` | _ref_[] | Yes | Component selection results per slot. |
| `validation` | object | No |  |
| `warnings` | _ref_[] | Yes | Non-fatal issues during composition. |
| `errors` | _ref_[] | No | Fatal issues that prevented composition. |
| `objectUsed` | object | No |  |
| `meta` | object | No |  |

## Error Codes

| Code | Description |
|------|-------------|
| `OODS-V001` | Input validation failed |
| `OODS-S001` | Internal server error |
| `OODS-V006` | Unknown component during slot selection |
| `OODS-N001` | Object not found in registry |

## Example Request

```json
{
  "intent": "<intent>"
}
```

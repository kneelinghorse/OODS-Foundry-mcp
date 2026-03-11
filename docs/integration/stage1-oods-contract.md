# Stage1 → OODS Foundry Integration Contract

**Version:** 1.0.0
**Date:** 2026-03-11
**Status:** Bilateral — all open questions resolved (Stage1 Sprint 26 response, 2026-03-11)

## Overview

This contract defines how Stage1 Inspector output artifacts map to OODS Foundry MCP tool inputs. The integration enables an automated pipeline: Stage1 inspects a live application, extracts design evidence, and OODS Foundry consumes that evidence to create component mappings, compose UI schemas, and build design tokens.

## Artifact → Tool Mapping Summary

| Stage1 Artifact | OODS Tool | Purpose |
|----------------|-----------|---------|
| `orca_candidates.json` | `map.create` | Map discovered components to OODS traits |
| `component_clusters.json` | `map.create` | Component signatures with prop inference |
| `ui_manifest_drafts.json` | `design.compose` | Component hints for composition |
| `token-guess.json` | `tokens.build` + `brand.apply` | Inferred tokens → OODS token pipeline |
| `style_fingerprint.json` | `brand.apply` | Typography, spacing, color scale overlays |
| `orca_candidates.json` (traits) | `tokens.build` | CSS-variable-sourced token values |

---

## 1. Component Mapping: Stage1 → `map.create`

### Source: `orca_candidates.json` → `objects[]`

Stage1 ORCA objects represent discovered components with evidence chains:

```json
{
  "id": "orca-obj-001",
  "name": "PricingCard",
  "category": "component",
  "evidence_chain": [
    { "pass": "dom.components", "artifact": "component_clusters.json", "selector": ".pricing-card" }
  ],
  "domain_hints": ["pricing", "subscription"],
  "recurrence_count": 4
}
```

### Target: `map.create` input

```json
{
  "externalSystem": "example-app",
  "externalComponent": "PricingCard",
  "oodsTraits": ["Priceable", "Labelled"],
  "propMappings": [
    { "externalProp": "price", "oodsProp": "price", "coercion": { "type": "identity" } },
    { "externalProp": "plan-name", "oodsProp": "label", "coercion": { "type": "identity" } },
    { "externalProp": "billing-period", "oodsProp": "interval", "coercion": {
      "type": "enum", "mapping": { "monthly": "month", "yearly": "year" }
    }}
  ],
  "confidence": "auto",
  "metadata": {
    "author": "stage1-orca",
    "notes": "Auto-mapped from ORCA object orca-obj-001, recurrence: 4"
  },
  "apply": true
}
```

### Mapping Rules

| Stage1 Field | OODS Field | Transform |
|-------------|------------|-----------|
| `objects[].name` | `externalComponent` | Direct |
| manifest `targets[].name` or `project_id` | `externalSystem` | Use project identifier as system name |
| `objects[].domain_hints` | `oodsTraits` | Map via domain→trait lookup (see table below) |
| `objects[].category` | — | Used to filter: only `component` and `entity` categories map |
| `objects[].recurrence_count` | `metadata.notes` | Include as evidence quality signal |
| cluster `props` | `propMappings` | Infer from `component_clusters.json` props |
| cluster `confidence` | `confidence` | `>= 0.7` → `"manual"`, `< 0.7` → `"auto"` |

### Domain Hint → OODS Trait Lookup

| Domain Hints | OODS Traits |
|-------------|-------------|
| `pricing`, `subscription`, `billing` | `Priceable`, `Stateful` |
| `user`, `profile`, `account` | `Identifiable`, `Labelled` |
| `form`, `input`, `field` | `Editable`, `Validatable` |
| `navigation`, `menu`, `sidebar` | `Navigable` |
| `status`, `badge`, `indicator` | `Stateful`, `Labelled` |
| `chart`, `metric`, `dashboard` | `Measurable`, `Labelled` |
| `list`, `table`, `grid` | `Listable`, `Sortable` |
| `media`, `image`, `avatar` | `Presentable` |
| `date`, `time`, `calendar` | `Temporal` |

> **Resolved:** Stage1 will expand domain_hints with ORCA-produced vocabulary + provide a domain_hint→OODS_domain translation table in the bridge.

---

## 2. Composition Hints: Stage1 → `design.compose`

### Source: `ui_manifest_drafts.json` → `drafts[]`

Stage1 component manifests describe the component inventory with props, behavior, and a11y contracts:

```json
{
  "component": {
    "id": "atom/button",
    "name": "Button",
    "type": "atom"
  },
  "data": {
    "props": [
      { "name": "variant", "type": "string", "options": ["primary", "secondary", "outline"] },
      { "name": "size", "type": "string", "options": ["sm", "md", "lg"] },
      { "name": "disabled", "type": "boolean", "default": "false" }
    ]
  },
  "design": {
    "tokens": { "font_family_primary": "system-ui", "border_radius": "8px" }
  },
  "metadata": {
    "confidence": 0.85,
    "tags": ["interactive", "cta"]
  }
}
```

### Target: `design.compose` input

```json
{
  "intent": "subscription management dashboard with pricing cards and user profile",
  "object": "Subscription",
  "context": "detail",
  "layout": "dashboard",
  "preferences": {
    "componentOverrides": {
      "pricing": "PricingCard",
      "profile": "UserAvatar"
    }
  },
  "options": {
    "validate": true,
    "topN": 3
  }
}
```

### Mapping Rules

| Stage1 Field | OODS Field | Transform |
|-------------|------------|-----------|
| ORCA `objects[].domain_hints` | `intent` | Concatenate domain hints into natural-language intent string |
| ORCA `objects[].name` (highest recurrence) | `object` | Match against OODS object registry (`Subscription`, `User`, etc.) |
| IA outline page `template_signature` | `layout` | `form:N>0` → `"form"`, `table:N>0` → `"list"`, else `"auto"` |
| Cluster `semanticRole` + `patternName` | `preferences.componentOverrides` | Map Stage1 clusters to OODS component names |
| Draft `metadata.tags` | `context` | `["settings"]` → `"form"`, `["dashboard"]` → `"detail"` |

### Intent Generation Strategy

Build the `intent` string from Stage1 evidence:

```
"{IA page description} with {top N component names by recurrence}"
```

Example: From a page with `route: "/billing"`, IA outline label "Billing & Plans", and top components `PricingCard` (4x), `PaymentMethod` (2x), `InvoiceTable` (1x):

```json
{
  "intent": "billing and plans dashboard with pricing cards and payment methods",
  "layout": "dashboard"
}
```

---

## 3. Token Pipeline: Stage1 → `tokens.build` + `brand.apply`

### Source: `token-guess.json`

Stage1 extracts inferred design tokens with confidence scores:

```json
{
  "kind": "token_guess",
  "tokens": {
    "colors.primary": { "value": "#2563eb", "confidence": 0.92, "occurrences": 47, "source": "css_variable" },
    "colors.text.primary": { "value": "#1f2937", "confidence": 0.88, "occurrences": 312, "source": "computed_style" },
    "typography.fontSize.md": { "value": "16px", "confidence": 0.95, "occurrences": 89, "source": "computed_style" },
    "spacing.md": { "value": "16px", "confidence": 0.78, "occurrences": 23, "source": "inferred" }
  }
}
```

### Target: `brand.apply` input (alias strategy)

`strategy` is top-level. For alias mode, `delta` is a plain object mapping DTCG token paths to new values:

```json
{
  "strategy": "alias",
  "delta": {
    "color.brand.primary": "#2563eb",
    "color.text.default": "#1f2937",
    "size.font.md": "16px",
    "size.spacing.md": "16px"
  },
  "apply": true
}
```

### Token Path Translation

Stage1 uses dot-notation paths. OODS uses DTCG-aligned paths. Translation table:

| Stage1 Path Pattern | OODS DTCG Path | Notes |
|--------------------|----------------|-------|
| `colors.primary` | `color.brand.primary` | |
| `colors.secondary` | `color.brand.secondary` | |
| `colors.background` | `color.surface.default` | |
| `colors.text.primary` | `color.text.default` | |
| `colors.text.secondary` | `color.text.muted` | |
| `colors.status.error` | `color.feedback.error` | |
| `colors.status.success` | `color.feedback.success` | |
| `typography.fontFamily.sans` | `font.family.sans` | |
| `typography.fontFamily.mono` | `font.family.mono` | |
| `typography.fontSize.*` | `size.font.*` | Preserve size key (xs/sm/md/lg/xl) |
| `typography.fontWeight.*` | `font.weight.*` | Preserve weight key |
| `typography.lineHeight.*` | `font.lineHeight.*` | |
| `spacing.*` | `size.spacing.*` | Preserve size key |
| `radius.*` | `size.radius.*` | |
| `shadow.*` | `elevation.shadow.*` | |

### Confidence Gating

Only tokens above a confidence threshold should flow into OODS:

| Confidence | Action |
|-----------|--------|
| >= 0.8 | Auto-apply via `brand.apply` with `apply: true` |
| 0.5 - 0.79 | Include in dry-run preview, flag for human review |
| < 0.5 | Exclude from OODS pipeline, log as low-confidence |

> **Resolved:** Stage1 filters tokens below 0.5 confidence before bridge output. OODS receives only actionable tokens. Threshold is configurable on Stage1's side.

---

## 4. Worked Examples

### Example A: E-commerce App Inspection → OODS Composition

**Stage1 runs against:** `https://shop.example.com`

**Step 1: Stage1 produces artifacts**

`orca_candidates.json`:
```json
{
  "objects": [
    { "id": "orca-001", "name": "ProductCard", "category": "component",
      "domain_hints": ["product", "pricing"], "recurrence_count": 12 },
    { "id": "orca-002", "name": "CartSummary", "category": "component",
      "domain_hints": ["cart", "pricing"], "recurrence_count": 3 }
  ],
  "traits": [
    { "id": "trait-001", "trait_type": "color", "value": "#059669",
      "source": "css_variable", "confidence": 0.91, "affected_objects": ["orca-001"] }
  ]
}
```

`token-guess.json`:
```json
{
  "tokens": {
    "colors.primary": { "value": "#059669", "confidence": 0.91, "occurrences": 34, "source": "css_variable" },
    "typography.fontFamily.sans": { "value": "Inter, sans-serif", "confidence": 0.97, "occurrences": 200, "source": "computed_style" },
    "spacing.md": { "value": "1rem", "confidence": 0.85, "occurrences": 45, "source": "computed_style" }
  }
}
```

**Step 2: Create OODS mappings**

```json
// map.create call 1
{
  "externalSystem": "shop-example",
  "externalComponent": "ProductCard",
  "oodsTraits": ["Priceable", "Labelled", "Presentable"],
  "confidence": "auto",
  "metadata": { "author": "stage1-orca", "notes": "12 instances found across 4 pages" },
  "apply": true
}

// map.create call 2
{
  "externalSystem": "shop-example",
  "externalComponent": "CartSummary",
  "oodsTraits": ["Priceable", "Listable"],
  "confidence": "auto",
  "metadata": { "author": "stage1-orca", "notes": "3 instances on cart/checkout pages" },
  "apply": true
}
```

**Step 3: Compose UI**

```json
// design.compose
{
  "intent": "product catalog with product cards and cart summary",
  "layout": "dashboard",
  "preferences": {
    "componentOverrides": { "items": "ProductCard" }
  }
}
```

**Step 4: Apply tokens**

```json
// brand.apply
{
  "strategy": "alias",
  "delta": {
    "color.brand.primary": "#059669",
    "font.family.sans": "Inter, sans-serif",
    "size.spacing.md": "1rem"
  },
  "apply": true
}
```

### Example B: SaaS Dashboard → OODS Object Composition

**Stage1 runs against:** `https://app.saas-tool.com/dashboard`

**Step 1: Stage1 artifacts**

`orca_candidates.json`:
```json
{
  "objects": [
    { "id": "orca-010", "name": "MetricWidget", "category": "component",
      "domain_hints": ["metric", "dashboard", "analytics"], "recurrence_count": 8 },
    { "id": "orca-011", "name": "UserRow", "category": "component",
      "domain_hints": ["user", "table", "list"], "recurrence_count": 25 }
  ]
}
```

`component_clusters.json`:
```json
{
  "clusters": [
    {
      "clusterId": "cl-metric-widget",
      "patternName": "MetricWidget",
      "semanticRole": "card",
      "props": {
        "title": { "type": "string", "required": true },
        "value": { "type": "number", "required": true },
        "trend": { "type": "string", "values": ["up", "down", "flat"] }
      },
      "confidence": 0.87,
      "totalInstances": 8
    }
  ]
}
```

**Step 2: Create mapping with prop translations**

```json
{
  "externalSystem": "saas-tool",
  "externalComponent": "MetricWidget",
  "oodsTraits": ["Measurable", "Labelled"],
  "propMappings": [
    { "externalProp": "title", "oodsProp": "label", "coercion": { "type": "identity" } },
    { "externalProp": "value", "oodsProp": "metric", "coercion": { "type": "identity" } },
    { "externalProp": "trend", "oodsProp": "trendDirection", "coercion": {
      "type": "enum", "mapping": { "up": "increasing", "down": "decreasing", "flat": "stable" }
    }}
  ],
  "confidence": "auto",
  "metadata": { "author": "stage1-orca", "notes": "8 instances, cluster confidence 0.87" },
  "apply": true
}
```

**Step 3: Object-backed composition**

```json
{
  "object": "Subscription",
  "context": "detail",
  "preferences": {
    "metricColumns": 4,
    "componentOverrides": { "metrics": "MetricWidget" }
  }
}
```

---

## 5. Pipeline Orchestration

The recommended integration flow:

```
Stage1 inspect_app(url)
  → orca_candidates.json
  → token-guess.json
  → component_clusters.json
  → ui_manifest_drafts.json
       │
       ▼
  ┌─ Token Pipeline ──────────────────┐
  │  1. Filter tokens by confidence   │
  │  2. Translate paths (Stage1→DTCG) │
  │  3. brand.apply(delta, apply)     │
  └───────────────────────────────────┘
       │
       ▼
  ┌─ Mapping Pipeline ───────────────────┐
  │  1. Filter ORCA objects (component/) │
  │  2. Resolve domain_hints → traits    │
  │  3. Extract props from clusters      │
  │  4. map.create() per component       │
  └──────────────────────────────────────┘
       │
       ▼
  ┌─ Composition Pipeline ──────────────────┐
  │  1. Build intent from IA + ORCA objects │
  │  2. Match objects to OODS registry      │
  │  3. design.compose(intent, object)      │
  │  4. pipeline(compose→validate→render)   │
  └─────────────────────────────────────────┘
```

---

## 6. Resolved Questions (Stage1 Sprint 26 Response)

1. **Domain hint vocabulary:** **Yes, expand.** ORCA produces `domain_hints` from API entity names (e.g., "product", "user", "order") and IA navigation labels. The bridge will include a `domain_hint→OODS_domain` translation table (e.g., "product"→`core.catalog`, "user"→`core.identity`, "billing"→`saas.billing`).

2. **Low-confidence token handling:** **Stage1 filters.** Tokens below 0.5 confidence are excluded from bridge output (threshold is configurable). OODS receives only actionable tokens.

3. **Prop type alignment:** **OODS v2.1.0 compatibility verified (Sprint 84).** ORCA inferred prop definitions `{type, values[], source, confidence}` map to OODS coercion types: `string+values[]`→`enum`, `boolean`→`boolean_to_string`, all others→`identity`. `source` and `confidence` are metadata fields that do not affect coercion. Helper: `orca-prop-compat.ts` provides `deriveCoercion()`, `orcaPropsToMappings()`, and `auditCompatibility()`. Integration tests cover v2.1.0 payloads end-to-end. Awaiting Stage1 Sprint 27 delivery for live prop inference data.

4. **Evidence passthrough:** **Yes.** ORCA `evidence_chain` serialized into `metadata.notes` on `map.create` calls. Full traceability from OODS composition back to Stage1 source artifacts.

5. **Incremental updates:** **ORCA output is idempotent per run.** Bridge uses `map.update` for existing mappings (matched by `externalSystem` + `externalComponent`), `map.create` for new ones. Stale mappings flagged for review, not auto-deleted.

---

## 7. Validation Checklist

Before implementing:

- [ ] Verify `map.create` Zod schema accepts all proposed fields
- [ ] Verify `design.compose` accepts `componentOverrides` in preferences
- [ ] Verify `brand.apply` alias strategy supports the override format
- [ ] Confirm token path translation table covers Stage1's token vocabulary
- [ ] Test with real Stage1 output from a sample app inspection
- [ ] Stage1 team reviews and confirms ORCA output stability

# Stage1 → OODS Foundry Integration Contract

**Version:** 1.2.3
**Date:** 2026-04-17
**Status:** Bilateral — Sprint 92 activates the `map.create` write path for `projection_variants[]`, unblocking Stage1 contract v1.5.0 (§7.3) bridge payloads

**Change log:**

- v1.2.3 (2026-04-17, Sprint 92 m01): Added §2e activating the `map.create` write path for `projection_variants[]`. Aligns with Stage1 contract v1.5.0 §7.3 (live on bridge mappings per run `dc1cfabb-f07a-47dc-8a23-ba160e5b45b9`). `map.create.input.json` now accepts the field; `map.create.ts` handler reads, persists (when `apply:true`), and round-trips it through `component-mappings.json`. Other unknown fields on `map.create` input continue to be rejected (input-level `additionalProperties: false` preserved). OODS-side contract versioning is independent from Stage1's; this remains v1.2.x.
- v1.2.2 (2026-04-16, Sprint 91): Added §2d documenting OODS-side **v1.4.0-gated schema stubs** only: `reconciliation_report.disambiguation_decisions[]`, a promoted `preferred_term` registry entity, a first-class `capability` entity, and dormant `projection_variants[]` on mappings. These are additive acceptance shapes only. Current OODS handlers do not consume them, and `map.apply` routing / `registry.snapshot` behavior remain unchanged.
- v1.2.1 (2026-04-15, Sprint 88.1): **Clarification of §2c** after inspecting the first real Stage1 BridgeSummary (linear.app run `aa22b12d-bd6a-4e71-90e0-399954a36a70`). `summary.action_mappings[]` on the wire uses `{orcaVerb, oodsTrait, suggestedAction}` (no per-entry `object`/`component`/`slot`/`confidence`) and is a small verb→trait **vocabulary**. Per-component evidence lives in a separate top-level `actions[]` array with `{actionId, verb, sourceComponent, targetEntity, confidence, confidenceLabel}`. Consumer now accepts both: `actionMappings` (verb→trait) + `actionInstances` (per-component). `orcaVerb` is an accepted alias for `verb`, `suggestedAction` is passed through as a display-label hint. Dual-feed behavior documented in §2c below.
- v1.2.0 (2026-04-15): Added §2c `action_mappings[]` — the flat verb-keyed BridgeSummary array consumed by `design.compose`. Each entry is keyed by `verb` (not by trait). Clarifies the difference between raw `action_candidates` (§2b, per-component evidence) and reconciled `action_mappings` (§2c, verb-level mapping used by consumers).
- v1.1.0 (2026-04-15): Added §2b action_candidates artifact pathway. OODS receiver side implemented in s87-m01: `state_machine` and `actions` fields now flow through TraitDefinition → design.compose `objectUsed.traitStateMachines` / `traitActions`. Stage1 Sprint 38 serialization fix confirmed complete.
- v1.0.0 (2026-03-11): Initial bilateral contract, Stage1 Sprint 26 response.

## Overview

This contract defines how Stage1 Inspector output artifacts map to OODS Foundry MCP tool inputs. The integration enables an automated pipeline: Stage1 inspects a live application, extracts design evidence, and OODS Foundry consumes that evidence to create component mappings, compose UI schemas, and build design tokens.

## Artifact → Tool Mapping Summary

| Stage1 Artifact                   | OODS Tool                           | Purpose                                                                 |
| --------------------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `orca_candidates.json`            | `map.create`                        | Map discovered components to OODS traits                                |
| `component_clusters.json`         | `map.create`                        | Component signatures with prop inference                                |
| `ui_manifest_drafts.json`         | `design.compose`                    | Component hints for composition                                         |
| `action_candidates`               | `design.compose` → `objectUsed`     | Cross-reference trait state_machine/actions (Sprint 38/87)              |
| `action_mappings` (BridgeSummary) | `design.compose` → slot `actions[]` | Flat verb-keyed mapping annotates composed slots/components (Sprint 88) |
| `token-guess.json`                | `tokens.build` + `brand.apply`      | Inferred tokens → OODS token pipeline                                   |
| `style_fingerprint.json`          | `brand.apply`                       | Typography, spacing, color scale overlays                               |
| `orca_candidates.json` (traits)   | `tokens.build`                      | CSS-variable-sourced token values                                       |

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
    {
      "pass": "dom.components",
      "artifact": "component_clusters.json",
      "selector": ".pricing-card"
    }
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
    {
      "externalProp": "price",
      "oodsProp": "price",
      "coercion": { "type": "identity" }
    },
    {
      "externalProp": "plan-name",
      "oodsProp": "label",
      "coercion": { "type": "identity" }
    },
    {
      "externalProp": "billing-period",
      "oodsProp": "interval",
      "coercion": {
        "type": "enum",
        "mapping": { "monthly": "month", "yearly": "year" }
      }
    }
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

| Stage1 Field                              | OODS Field          | Transform                                                    |
| ----------------------------------------- | ------------------- | ------------------------------------------------------------ |
| `objects[].name`                          | `externalComponent` | Direct                                                       |
| manifest `targets[].name` or `project_id` | `externalSystem`    | Use project identifier as system name                        |
| `objects[].domain_hints`                  | `oodsTraits`        | Map via domain→trait lookup (see table below)                |
| `objects[].category`                      | —                   | Used to filter: only `component` and `entity` categories map |
| `objects[].recurrence_count`              | `metadata.notes`    | Include as evidence quality signal                           |
| cluster `props`                           | `propMappings`      | Infer from `component_clusters.json` props                   |
| cluster `confidence`                      | `confidence`        | `>= 0.7` → `"manual"`, `< 0.7` → `"auto"`                    |

### Domain Hint → OODS Trait Lookup

| Domain Hints                         | OODS Traits                |
| ------------------------------------ | -------------------------- |
| `pricing`, `subscription`, `billing` | `Priceable`, `Stateful`    |
| `user`, `profile`, `account`         | `Identifiable`, `Labelled` |
| `form`, `input`, `field`             | `Editable`, `Validatable`  |
| `navigation`, `menu`, `sidebar`      | `Navigable`                |
| `status`, `badge`, `indicator`       | `Stateful`, `Labelled`     |
| `chart`, `metric`, `dashboard`       | `Measurable`, `Labelled`   |
| `list`, `table`, `grid`              | `Listable`, `Sortable`     |
| `media`, `image`, `avatar`           | `Presentable`              |
| `date`, `time`, `calendar`           | `Temporal`                 |

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
      {
        "name": "variant",
        "type": "string",
        "options": ["primary", "secondary", "outline"]
      },
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

| Stage1 Field                               | OODS Field                       | Transform                                                         |
| ------------------------------------------ | -------------------------------- | ----------------------------------------------------------------- |
| ORCA `objects[].domain_hints`              | `intent`                         | Concatenate domain hints into natural-language intent string      |
| ORCA `objects[].name` (highest recurrence) | `object`                         | Match against OODS object registry (`Subscription`, `User`, etc.) |
| IA outline page `template_signature`       | `layout`                         | `form:N>0` → `"form"`, `table:N>0` → `"list"`, else `"auto"`      |
| Cluster `semanticRole` + `patternName`     | `preferences.componentOverrides` | Map Stage1 clusters to OODS component names                       |
| Draft `metadata.tags`                      | `context`                        | `["settings"]` → `"form"`, `["dashboard"]` → `"detail"`           |

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

## 2b. Action Candidates: Stage1 → `design.compose` (Sprint 38 / Sprint 87)

> **Status:** OODS receiver side ready (s87-m01). Stage1 Sprint 38 serialization complete.

### Overview

Stage1 Sprint 38 adds an `action_candidates` artifact surfacing per-component actions inferred from DOM event listeners, form submissions, and interaction patterns. OODS Sprint 87 wires the receiver side: `state_machine` and `actions` fields from trait YAMLs now flow through the full stack, and `design.compose` exposes them in `objectUsed`.

### Source: `action_candidates` artifact (Stage1 Sprint 38)

Stage1 serializes action candidates per discovered component:

```json
{
  "candidates": [
    {
      "componentId": "orca-obj-001",
      "componentName": "SubscriptionCard",
      "actions": [
        {
          "name": "cancel",
          "trigger": "click",
          "selector": ".btn-cancel",
          "confidence": 0.87
        },
        {
          "name": "upgrade",
          "trigger": "click",
          "selector": ".btn-upgrade",
          "confidence": 0.91
        }
      ]
    }
  ]
}
```

### Target: `design.compose` output — `objectUsed.traitStateMachines` / `traitActions`

When `design.compose` is called with an object that has traits defining `state_machine` or `actions`, those are now included in the response:

```json
{
  "objectUsed": {
    "name": "Subscription",
    "traits": ["Stateful", "Priceable", "InteractionHighlight"],
    "traitStateMachines": [
      {
        "trait": "InteractionHighlight",
        "stateMachine": {
          "states": ["idle", "highlighted"],
          "initial": "idle",
          "transitions": [
            { "from": "idle", "to": "highlighted", "trigger": "select" },
            { "from": "highlighted", "to": "idle", "trigger": "clear" }
          ]
        }
      }
    ],
    "traitActions": []
  }
}
```

### Mapping Strategy

Stage1 `action_candidates` should be cross-referenced with OODS `traitStateMachines` to validate:

1. Action names in Stage1 evidence align with `transition.trigger` values in OODS state machines
2. Stage1-inferred `actions[]` augment OODS `traitActions[]` with real-world usage evidence
3. Discrepancies (Stage1 finds an action OODS doesn't declare) → flag for trait authoring review

### Capability vs. Trait Clarification

> **Resolved 2026-04-15:** Stage1 Sprint 38 asked whether OODS has a "capability" concept distinct from "trait." Answer: **No.** In OODS, the equivalent of a capability is a `trait`. `state_machine` and `actions` fields on traits represent the behavioral contract of that capability. Stage1 should map `capability` vocabulary to `trait` when bridging to OODS.

---

## 2c. Action Mappings: BridgeSummary → `design.compose` (Sprint 88)

> **Status:** OODS receiver implemented in Sprint 88 (s88-m02). Contract is the authoritative shape for consumer code.

### Shape: dual-feed — `summary.action_mappings[]` (vocabulary) + `actions[]` (per-component instances)

Inspection of the first real Stage1 BridgeSummary (linear.app run `aa22b12d-bd6a-4e71-90e0-399954a36a70`, 2026-04-15) revealed that BridgeSummary actually exposes action information through **two complementary arrays**. The consumer (`design.compose`) now reads both.

**Feed 1 — `summary.action_mappings[]`** (the verb→trait vocabulary)

On the wire:

```json
{
  "orcaVerb": "submit",
  "oodsTrait": "interactive",
  "suggestedAction": "Submit"
}
```

- Small array (typically 2–10 entries on real runs). Defines which OODS trait each ORCA verb belongs to.
- Consumer accepts `orcaVerb` as an alias for `verb`, and `oodsTrait` (preferred) or `trait` for the trait ref.
- `suggestedAction` is an optional display label, passed through for rendering hints.
- The richer per-entry shape shown in earlier revisions of this spec (`{verb, object, oodsTrait, component?, slot?, confidence?, evidence?}`) is STILL accepted — producers MAY emit either the minimal Stage1 shape or the expanded shape interchangeably.

**Feed 2 — top-level `actions[]`** (per-component action instances)

On the wire:

```json
{
  "actionId": "action-submit-cluster-cluster-48",
  "name": "Flex Root Doqcw",
  "verb": "submit",
  "sourceComponent": "Flex Root Doqcw",
  "targetEntity": "entity-customer",
  "confidence": 0.5,
  "confidenceLabel": "medium"
}
```

- One entry per discovered action instance on a component. Sized proportional to the inspected surface (13 entries on linear.app).
- `sourceComponent` narrows attachment to specific composed nodes; `targetEntity` is an ORCA entity reference that may or may not resolve to an OODS object.
- Consumer uses Feed 1 to resolve `verb → trait`, then walks Feed 2 to attach the verb to slots/components whose `sourceComponent` matches a node in the composed schema AND whose trait is actually carried by the composed object.

### Consumer pipeline (design.compose)

Inputs: `actionMappings: ActionMapping[]` (Feed 1), `actionInstances: ActionInstance[]` (Feed 2).

1. Build verb→trait lookup from `actionMappings[]`.
2. For each `actionInstance`, resolve its verb through the lookup; discard verbs not in vocabulary.
3. Drop entries whose resolved trait is not carried by the composed object.
4. Attach verbs to matching slots (by `component`/`slot` hints when present) and roll up to `objectUsed.resolvedActions`.

Empty inputs are a safe no-op. Absent inputs preserve pre-Sprint-88 output shape.

### Historical shape (still accepted)

The expanded `{verb, object, oodsTrait, component, slot, confidence}` shape is still fully supported — see example below. It remains the cleanest way to emit per-object, per-slot verb assignments when the producer has that level of evidence.

```json
{
  "action_mappings": [
    {
      "verb": "archive",
      "object": "Subscription",
      "oodsTrait": "Archivable",
      "component": "SubscriptionCard",
      "slot": "actions",
      "confidence": 0.91,
      "evidence": { "run": "6d75dde3", "selector": ".btn-archive" }
    },
    {
      "verb": "cancel",
      "object": "Subscription",
      "oodsTrait": "Cancellable",
      "component": "SubscriptionCard",
      "slot": "actions",
      "confidence": 0.88,
      "evidence": { "run": "6d75dde3", "selector": ".btn-cancel" }
    },
    {
      "verb": "restore",
      "object": "Subscription",
      "oodsTrait": "Archivable",
      "confidence": 0.72
    }
  ]
}
```

Notes:

- **Do NOT** nest actions under a trait object — each verb is its own top-level entry. Grouping happens on the consumer side by matching `oodsTrait` against slot/component `oodsTrait` values.
- `component` and `slot` are optional hints that narrow matching; when absent, the consumer falls back to trait-only matching across all nodes carrying that `oodsTrait`.
- A given trait appearing with multiple verbs produces multiple entries (e.g. `Archivable` appears for both `archive` and `restore`).

### Consumer behavior in `design.compose`

Given `actionMappings: [...]` in the input, `design.compose`:

1. Walks composed slots/components and reads `oodsTrait` on each node.
2. For each node, selects mappings where `oodsTrait` matches AND (if `component`/`slot` is present on the mapping) the hint matches the node.
3. Attaches `actions: [verb, verb, ...]` (de-duplicated, order-stable) to the matching node. Nodes with no match get no `actions` field.

Example: for a `SubscriptionCard` slot carrying `oodsTrait: "Archivable"`, the mappings above produce `actions: ["archive", "restore"]` on that slot.

### Invariants

- Empty `action_mappings: []` → no `actions` fields added; composition output is unchanged.
- `actionMappings` is optional. Absent → identical behavior to pre-Sprint-88 `design.compose`.
- Order of verbs in `actions[]` follows the order of appearance in `action_mappings[]` (stable sort for determinism).

---

## 2d. Planned v1.4.0 Stubs: Review Decisions + Cross-Surface Identity

> **Status:** OODS-side schemas landed in Sprint 91 as additive acceptance stubs only. These shapes are **reserved for Stage1 contract v1.4.0** and do not change current handler behavior.

OODS now reserves four future-facing surfaces so Stage1 can ship Sprint 44 / Sprint 45 payloads without a receiver-side schema scramble:

1. `reconciliation_report.disambiguation_decisions[]`
   - Optional review-decision ingress on the reconciliation report.
   - Intended for run-scoped or target-scoped human/agent choices such as preferred name, preferred role, mapping rejection, or promotion to a canonical term.
   - Current `map.apply` accepts the field but ignores it. Routing still depends only on `candidate_objects[]`, `minConfidence`, and existing write-side verdict logic.

2. `preferred_term` entity
   - Draft registry entity for promoted disambiguation/canonical-term decisions.
   - Supports the Sprint 44 Option C position: Stage1 keeps in-flight review state locally, then promotes stable outcomes into OODS.
   - Present only as a schema/type stub today; no registry handler persists or emits it yet.

3. `capability` entity
   - Draft first-class entity for Stage1 capability rollup output.
   - Aligns with the Sprint 45 position that capabilities should not be denormalized onto individual component instances.
   - Present only as a schema/type stub today; no compose/render/codegen surface consumes it yet.

4. `projection_variants[]` on mappings
   - Draft cross-surface identity relation for maps.
   - Intended to represent desktop/mobile/modal/sidebar projections of the same canonical mapping, optionally linked to a first-class capability.
   - Present only as an optional schema field today. Existing write paths do not emit or mutate it.

### Compatibility note

- These additions are **opt-in and additive**.
- Existing `schema_version: "1.1.0"` reconciliation reports continue to validate unchanged.
- Current OODS behavior is unchanged:
  - `map.apply` routing does not look at `disambiguation_decisions[]`.
  - `registry.snapshot` does not gain new active handler output from these stubs.
  - No current tool writes `preferred_term`, `capability`, or `projection_variants[]`.

---

## 2e. Activated v1.5.0: `map.create` accepts `projection_variants[]` (Sprint 92)

> **Status:** Live. Sprint 92 activated the write path for `projection_variants[]` on `map.create`. Aligns with Stage1 contract v1.5.0 §7.3.

### Shape (per-variant)

```json
{
  "id": "variant-1",
  "surface": "desktop",
  "external_component": "IssueRow",
  "capability_id": "cap-1",
  "selector": ".issue-row",
  "confidence": 0.92,
  "evidence_chain": [{ "pass": "dom.components" }],
  "metadata": {}
}
```

- `id` (required): stable identifier for the projection variant.
- `surface` (required): surface label such as `desktop`, `mobile`, `modal`, `sidebar`.
- `external_component` (optional): surface-specific component label when it differs from the canonical mapping's `externalComponent`.
- `capability_id` (optional): first-class capability entity link (see §2d).
- `selector` (optional): representative selector or cluster signature.
- `confidence` (optional, `[0, 1]`): cross-surface identity-merge confidence.
- `evidence_chain` (optional): open array of evidence objects.
- `metadata` (optional): open object reserved for future details.

### Target: `map.create` input

```json
{
  "externalSystem": "linear",
  "externalComponent": "Issue Row",
  "oodsTraits": ["Listable"],
  "projection_variants": [
    { "id": "variant-1", "surface": "desktop" },
    { "id": "variant-2", "surface": "mobile", "external_component": "IssueCard" }
  ],
  "apply": true
}
```

### Handler behavior

- `map.create.input.json` accepts `projection_variants[]` (item schema mirrors `stage1-projection-variant.json`).
- `map.create.ts` reads `input.projection_variants`; when non-empty, it flows into the persisted `ComponentMapping.projection_variants`.
- `apply:false` (dry run) returns the mapping with `projection_variants` in the response but does not write to disk.
- `apply:true` writes to `artifacts/structured-data/component-mappings.json` via the existing `saveMappings` path.
- Input-level `additionalProperties: false` is preserved — only `projection_variants` is newly whitelisted; other unknown fields still reject.

### Bilateral versioning note

OODS-side contract doc versioning is independent from Stage1's. OODS contract stays in the 1.2.x line; Stage1 wire contract is v1.5.0. Future alignment may warrant a bump to OODS-side v1.3.0 when write-side coverage of v1.4.0 stubs (§2d) is activated.

---

## 3. Token Pipeline: Stage1 → `tokens.build` + `brand.apply`

### Source: `token-guess.json`

Stage1 extracts inferred design tokens with confidence scores:

```json
{
  "kind": "token_guess",
  "tokens": {
    "colors.primary": {
      "value": "#2563eb",
      "confidence": 0.92,
      "occurrences": 47,
      "source": "css_variable"
    },
    "colors.text.primary": {
      "value": "#1f2937",
      "confidence": 0.88,
      "occurrences": 312,
      "source": "computed_style"
    },
    "typography.fontSize.md": {
      "value": "16px",
      "confidence": 0.95,
      "occurrences": 89,
      "source": "computed_style"
    },
    "spacing.md": {
      "value": "16px",
      "confidence": 0.78,
      "occurrences": 23,
      "source": "inferred"
    }
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

| Stage1 Path Pattern          | OODS DTCG Path           | Notes                              |
| ---------------------------- | ------------------------ | ---------------------------------- |
| `colors.primary`             | `color.brand.primary`    |                                    |
| `colors.secondary`           | `color.brand.secondary`  |                                    |
| `colors.background`          | `color.surface.default`  |                                    |
| `colors.text.primary`        | `color.text.default`     |                                    |
| `colors.text.secondary`      | `color.text.muted`       |                                    |
| `colors.status.error`        | `color.feedback.error`   |                                    |
| `colors.status.success`      | `color.feedback.success` |                                    |
| `typography.fontFamily.sans` | `font.family.sans`       |                                    |
| `typography.fontFamily.mono` | `font.family.mono`       |                                    |
| `typography.fontSize.*`      | `size.font.*`            | Preserve size key (xs/sm/md/lg/xl) |
| `typography.fontWeight.*`    | `font.weight.*`          | Preserve weight key                |
| `typography.lineHeight.*`    | `font.lineHeight.*`      |                                    |
| `spacing.*`                  | `size.spacing.*`         | Preserve size key                  |
| `radius.*`                   | `size.radius.*`          |                                    |
| `shadow.*`                   | `elevation.shadow.*`     |                                    |

### Confidence Gating

Only tokens above a confidence threshold should flow into OODS:

| Confidence | Action                                            |
| ---------- | ------------------------------------------------- |
| >= 0.8     | Auto-apply via `brand.apply` with `apply: true`   |
| 0.5 - 0.79 | Include in dry-run preview, flag for human review |
| < 0.5      | Exclude from OODS pipeline, log as low-confidence |

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
    {
      "id": "orca-001",
      "name": "ProductCard",
      "category": "component",
      "domain_hints": ["product", "pricing"],
      "recurrence_count": 12
    },
    {
      "id": "orca-002",
      "name": "CartSummary",
      "category": "component",
      "domain_hints": ["cart", "pricing"],
      "recurrence_count": 3
    }
  ],
  "traits": [
    {
      "id": "trait-001",
      "trait_type": "color",
      "value": "#059669",
      "source": "css_variable",
      "confidence": 0.91,
      "affected_objects": ["orca-001"]
    }
  ]
}
```

`token-guess.json`:

```json
{
  "tokens": {
    "colors.primary": {
      "value": "#059669",
      "confidence": 0.91,
      "occurrences": 34,
      "source": "css_variable"
    },
    "typography.fontFamily.sans": {
      "value": "Inter, sans-serif",
      "confidence": 0.97,
      "occurrences": 200,
      "source": "computed_style"
    },
    "spacing.md": {
      "value": "1rem",
      "confidence": 0.85,
      "occurrences": 45,
      "source": "computed_style"
    }
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
    {
      "id": "orca-010",
      "name": "MetricWidget",
      "category": "component",
      "domain_hints": ["metric", "dashboard", "analytics"],
      "recurrence_count": 8
    },
    {
      "id": "orca-011",
      "name": "UserRow",
      "category": "component",
      "domain_hints": ["user", "table", "list"],
      "recurrence_count": 25
    }
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
    {
      "externalProp": "title",
      "oodsProp": "label",
      "coercion": { "type": "identity" }
    },
    {
      "externalProp": "value",
      "oodsProp": "metric",
      "coercion": { "type": "identity" }
    },
    {
      "externalProp": "trend",
      "oodsProp": "trendDirection",
      "coercion": {
        "type": "enum",
        "mapping": {
          "up": "increasing",
          "down": "decreasing",
          "flat": "stable"
        }
      }
    }
  ],
  "confidence": "auto",
  "metadata": {
    "author": "stage1-orca",
    "notes": "8 instances, cluster confidence 0.87"
  },
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

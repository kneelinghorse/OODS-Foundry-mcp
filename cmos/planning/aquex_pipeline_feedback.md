# Aquex Pipeline Feedback Report
> **STATUS: HISTORICAL — All P0 and P1 items resolved (S85/S86). BUG-4 confirmed fixed (commit 747ce79). Antigravity arc closed. This was a one-off scoped test; external testing going forward is ad-hoc, multi-agent, and owner-directed — not a repeatable structured process.**

**Sessions:** 2 (March 13 + March 15, 2026)  
**Scope:** Stage1 Inspector → OODS Bridge → OODS Foundry end-to-end  
**Test Target:** SaaS subscription + billing flows (Subscription, Plan objects)  
**Author:** AI Agent (Antigravity) — written from an agent-native DX perspective

---

## Executive Summary

The Stage1 → OODS Foundry pipeline is materially usable today. The `pipeline` tool is fast (37ms median), the `design.compose` intent parser works well for object-driven layouts, and `code.generate` produces clean typed React that's ready to drop into a project. The biggest gap isn't the pipeline — it's the **dark mode rendering bug**: components reference hardcoded light fallbacks even when `theme="dark"` is passed. Everything else is fit-for-purpose with fixable rough edges.

**Bottom line ratings:**

| Tool | Maturity | Verdict |
|------|----------|---------|
| `stage1_guided_start/end` | ✅ Production | Solid, fast, trustworthy |
| `stage1_inspect_guided` | ✅ Production | Clean ORCA output |
| `stage1_oods_bridge` | 🔶 Beta | Usable but cluster names are too generic |
| `pipeline` (compose→codegen) | ✅ Production | Fast & reliable |
| `design.compose` | ✅ Production | Object-aware, good field binding |
| `viz_compose` | ✅ Production | Works well, good encodings |
| `tokens_build` | ✅ Production | Clean output, right artifacts |
| `repl.render` (dark theme) | 🔴 Bug | Light fallbacks hardcoded — see §3 |
| `brand.apply` | 🔶 Untested Live | Preview looks correct, schema coverage gap |
| `repl_validate` (a11y) | ✅ Production | Catches real issues |

---

## 1. Stage1 Inspector

### What We Tested
- Guided capture (`stage1_guided_start` → navigate → `stage1_guided_end`) on `cmos-mcp.com`
- Post-capture analysis via `stage1_inspect_guided`
- OODS bridge translation via `stage1_oods_bridge`

### Findings

**Route Coverage Gap** — 3 routes were missed during the initial guided session (project-level sprint view, session detail, message thread). The tool gives no signal mid-session that it's tracking coverage. Without a live coverage HUD or a `stage1_guided_checkpoint` call surfacing "routes seen vs. routes found from crawl", agents will tend to end sessions early and lose coverage without knowing it.

> **Suggested fix:** `stage1_guided_checkpoint` should return a `missedRoutes: string[]` array populated from the static link graph vs. visited set. Agents can then programmatically decide to stay in session or schedule a follow-up.

**ORCA Cluster Naming is Too Generic** — The bridge translates ORCA candidate clusters into OODS mappings, but cluster names like `cluster-0`, `cluster-1` make semantic mapping nearly useless without manual inspection. For example, the dashboard's KPI cards, the navigation bar, and the activity feed were all legible in the DOM but came out as anonymous clusters.

> **Suggested fix:** Add a `domainHints: string[]` parameter to `stage1_oods_bridge`. When an agent passes `["kpi-card", "global-nav", "activity-feed"]`, the bridge can use those as candidate cluster labels during ORCA name assignment. This is a low-cost, high-value enhancement for agent workflows.

**Stage1 Evidence Quality is Good** — The screenshot + computed styles capture is solid. CSS fingerprinting caught the correct font stack, color primitives, and border radius system. This translates well into `brand.apply` delta candidates.

**Navigation IA Issue Identified** — Stage1 evidence surfaced a real UX bug in the target app: global navigation and project-level navigation share the same visual tier, making it ambiguous where you are in the IA. There's no project context in the global header. This would likely go unnoticed in manual review — the structured DOM capture is where it shines.

**`Notifications7` Badge Leak** — The badge count "7" leaked into the link text as `Notifications7`, which would surface as an accessibility failure in a screen reader and likely fail automated a11y scans. Stage1 caught it via the link text inventory.

---

## 2. OODS Foundry Pipeline

### What We Ran

Three full pipeline runs against the `saas.billing` domain:

| Run | Object | Context | Components | Fields Bound | A11y |
|-----|--------|---------|-----------|-------------|------|
| Subscription Detail | Subscription | `detail` | 9 | 6 / 18 | 1 warning |
| Subscription List | Subscription | `list` | 8 | 3 / 18 | 0 |
| Plan Form | Plan | `form` | 11 | **11 / 29** | 1 warning |
| Revenue Chart | Subscription | `viz` | 5 | amount, created_at, status | — |

### Speed

Pipeline latency breakdown (Plan form run, representative):
```
compose: 25ms  validate: 8ms  render: 1ms  codegen: 1ms  save: 2ms
Total:   37ms
```
This is excellent. For an end-to-end AI-native design pipeline, 37ms is fast enough to be invisible in agent loops.

### Field Binding Observations

The **form context produces the highest field bind rate** (11/29 = 38% for Plan). Detail gets 33%, list gets 17%. This pattern is expected — form context has field-level signal from the schema, while list context has to infer what to surface. 

The lower bind rate in list/detail contexts is not a bug — it reflects that many Subscription fields (like `rolloverStrategy`, `samples`, `featureMatrix`) have no natural surface in a summary view. But agents have no visibility into *which* fields were surfaced vs. dropped and *why*. This makes schema refinement opaque.

> **Suggested enhancement:** Add a `fieldsOmitted: [{field, reason}]` array to pipeline metrics. Agents could use this to understand the layout logic and wire additional fields manually.

### Code Quality

Generated React TypeScript is production-grade:
- Correct `interface` with full field docstrings from the OODS registry
- `handleChange_*` scaffolds per bound field
- `required` attributes correctly inferred from schema optionality
- `DatePicker` correctly used for `period_start` (temporal field detection works)
- `Textarea` correctly used for the long-text `plan_name` field

The **one structural issue**: the `Button` in the form actions slot is rendered as `<Button id="slot-actions-8" data-oods-component="Button" />` with no label, variant, or submit handler wired. It's a placeholder that requires manual completion. This is expected behavior but worth surfacing explicitly — the codegen could emit a `// TODO: wire submit action` comment on that slot.

### viz_compose

Used to build a revenue line chart from `Subscription` data:
```
x: created_at  y: amount  color: status
```

Output was correct — 5 components, proper mark-line trait, axis encodings resolved. No issues. The tool is clean and the API is intuitive. One note: no schema preview is returned by default (compact mode), so agents can't inspect the intermediate schema without a separate `schema.load` call. Fine for production, slightly opaque for debugging.

---

## 3. Dark Mode Bug — Root Cause Analysis

This is the most impactful bug in the pipeline today.

### Symptom
When `theme: "dark"` is passed to `pipeline`, the rendered HTML includes `data-theme="dark"` on `<html>` and `<body>`, but the visual output is light-themed.

### Root Cause

The component CSS in `<style data-source="components">` uses **reference tokens** (`--ref-*`) with hardcoded light fallbacks:

```css
/* ACTUAL (broken) */
#oods-preview-root {
  background: var(--ref-color-neutral-50, #f8fafc);  /* light gray */
  color: var(--ref-color-neutral-900, #0f172a);       /* near-black */
}

[data-oods-component="Card"] {
  background: var(--ref-color-neutral-0, #ffffff);    /* white */
  border: 1px solid var(--ref-color-neutral-200, #e2e8f0);
}
```

```css
/* CORRECT should be */
#oods-preview-root {
  background: var(--sys-surface-canvas);   /* semantic — resolves per theme */
  color: var(--sys-text-primary);          /* semantic — resolves per theme */
}
```

Token architecture uses a two-tier system: **reference tokens** (`--ref-*`) are static primitives (colors, spacing constants), while **semantic tokens** (`--sys-*`) are the theme-aware aliases that change value based on `[data-theme]`. 

The component stylesheet is wiring directly to `--ref-*` instead of `--sys-*`, which means theme switching has zero effect — the fallback values are always the light-mode primitives.

### The `brand.apply` Dry-Run Confirms the Gap

Running `brand.apply` with a dark-alias delta produced this result:
```
Updated 21 token values for brand A
  base.json:  +7 tokens
  dark.json:  +7 tokens  
  hc.json:    +7 tokens
```

The delta adds `alias: --theme-dark-*` references — but these aliases target the brand token layer, not the component render CSS. The component stylesheet never reads these aliases. **Both layers exist but don't connect**: the token build system produces the right CSS variables, but the renderer writes component CSS that bypasses the semantic layer entirely.

### Fix Recommendation

The renderer (`repl.render`) should use `--sys-*` semantic token variables in its component CSS output, not `--ref-*` primitives. The `tokens_build` output already includes the correct semantic CSS variables — they just need to be consumed by the component styles.

Example fix pattern:
```css
/* Before */
background: var(--ref-color-neutral-50, #f8fafc);

/* After */  
background: var(--sys-surface-canvas);
```

For the preview sandbox where `tokens.css` is omitted (compact mode), a fallback chain is acceptable:
```css
background: var(--sys-surface-canvas, var(--ref-color-neutral-50, #f8fafc));
```

This preserves degraded fallback behavior while making dark mode work when tokens are loaded.

### WCAG Contrast Warning (Recurring)

Both Subscription detail and Plan form generated this warning:
```
A11Y_CONTRAST: sys.text.muted on sys.surface.canvas — ratio 2.68:1, minimum 4.5:1
```

This is the semantic dark theme's muted text on canvas background failing WCAG AA. The contrast issue exists in the token values themselves, not just the rendering. The `--theme-dark-text-muted` value is too close to `--theme-dark-surface-canvas` in luminance. This needs a token value fix, not a rendering fix.

---

## 4. brand.apply — Behavioral Notes

The dry-run delta revealed unexpected behavior: `brand.apply` with `strategy: "alias"` applied the 7-token delta to **all three theme files** (`base`, `dark`, `hc`), not just the dark theme. 

This means an agent passing a dark-specific alias delta will inadvertently overwrite base and HC theme tokens with dark theme aliases. The tool has no `theme` filter parameter to scope which theme files are modified.

> **Suggested fix:** Add a `themes: ["dark"]` parameter to `brand.apply` to scope modifications to specific theme files. Without this, multi-theme alias deltas require careful manual coordination.

---

## 5. Agent-Native DX Assessment

Testing this pipeline from an agent's perspective over two sessions, here's what worked and what created friction:

### What Works Well (Agent-Native)

- **Object-driven composition** — passing `object: "Subscription"` and letting the pipeline resolve traits, fields, and components is exactly how agent-native tools should work. No manual component selection needed.
- **Schema persistence** (`save` parameter) — critical for multi-step agent workflows. Being able to `schema.load` across tool calls allows agents to build iterative pipelines without re-generating.
- **Validation as a step** — having `validate` inline in the pipeline means agents get quality signals without a separate tool call. The A11y warnings are actionable and specific.
- **TypeScript interface generation** — the `PageProps` interface with field-level docstrings from the OODS registry is genuinely useful. Agents can reason about the component contract.
- **Compact mode** — the `tokenCssRef` pattern is a good developer ergonomic. Reduces response payload significantly (the raw HTML alone is ~20KB).

### Friction Points (Agent-Native)

**1. No feedback on omitted fields**  
The pipeline silently drops fields that don't map to a view slot. Agents have no way to know which 12/18 Subscription fields were dropped from the detail view and why. Add `metrics.fieldsOmitted: [{field, reason}]`.

**2. `schemaRef` TTL is invisible during composition**  
The `schemaRef` has a 30-minute TTL. In a multi-step agent session with tool latency and user interaction, this can silently expire. The tool returns `expiresAt` but agents don't get a TTL-exceeded signal — the ref just returns an error. A proactive "schema approaching TTL" signal in checkpoint responses would help.

**3. Button action slot is always a blank placeholder**  
Every form generated so far has `<Button />` with no label or action. This requires manual wiring every time. For the most common case (form submit), the pipeline should emit a default: `<Button type="submit">Save</Button>`.

**4. `viz_compose` has no preview mode**  
There's no way to see the schema before rendering without a separate `repl.render` call. Other pipeline tools have a `dry-run` or `preview` mode. `viz_compose` skips straight to schema. Minor but consistent with the compact mode pattern elsewhere.

**5. `stage1_oods_bridge` output is not immediately consumable**  
The bridge's primary output — ORCA cluster → OODS mapping — requires manual review because the cluster names are positional, not semantic. An agent can't confidently pass bridge output directly to `map.create` without human-in-the-loop verification. This breaks automated pipeline flows.

**6. No `context` filter on field binding**  
`billing_interval` and `currency` make sense in a list view, but `rolloverStrategy` and `featureMatrix` don't. The pipeline makes these decisions internally but doesn't explain them. A `contextRules: {}` escape hatch would let agents override field-to-context placement.

---

## 6. Recommendations — Priority Order

### P0 — Bug Fixes

| # | Issue | Fix |
|---|-------|-----|
| 1 | Dark mode CSS uses `--ref-*` not `--sys-*` | Renderer must emit semantic token vars in component CSS |
| 2 | `--theme-dark-text-muted` fails WCAG AA 4.5:1 | Increase luminance gap in dark theme token values |
| 3 | `brand.apply` modifies all themes without scope filter | Add `themes: string[]` parameter |

### P1 — High-Value Enhancements

| # | Issue | Enhancement |
|---|-------|-------------|
| 4 | Field omission is opaque | Add `metrics.fieldsOmitted: [{field, reason}]` to pipeline |
| 5 | Bridge cluster names are generic | Add `domainHints: string[]` to `stage1_oods_bridge` |
| 6 | Stage1 misses routes silently | `stage1_guided_checkpoint` should return `missedRoutes[]` |
| 7 | Form Button slot always blank | Default to `<Button type="submit">Save</Button>` in form context |

### P2 — Nice-to-Have

| # | Issue | Enhancement |
|---|-------|-------------|
| 8 | `schemaRef` can silently expire | Emit TTL warning in tool responses when < 5min remaining |
| 9 | `viz_compose` no preview mode | Add `preview: true` option to return schema only, no render |
| 10 | Context-level field placement | Add `contextRules: {}` override to pipeline |

---

## 7. Generated Artifacts (This Session)

All schemas saved to OODS Foundry for reuse:

| Schema Name | Object | Context | Fields Bound |
|---|---|---|---|
| `subscription-detail-dark` | Subscription | detail | 6 |
| `subscription-list-dark` | Subscription | list | 3 |
| `plan-form-dark` | Plan | form | 11 |

Dark theme tokens built and applied via `tokens_build(theme="dark", apply=True)`.

---

## Appendix: Key Data Points

**Plan form pipeline latency:** compose 25ms / validate 8ms / render 1ms / codegen 1ms / save 2ms = **37ms total**

**brand.apply delta (dry-run):**
```json
{
  "border.strong": "--theme-dark-border-strong",
  "border.subtle": "--theme-dark-border-subtle", 
  "surface.canvas": "--theme-dark-surface-canvas",
  "surface.raised": "--theme-dark-surface-raised",
  "text.muted": "--theme-dark-text-muted",
  "text.primary": "--theme-dark-text-primary",
  "text.secondary": "--theme-dark-text-secondary"
}
```
Result: 21 tokens updated across base/dark/hc — confirms schema layer is correct; the rendering layer is where the disconnect lives.

**Dark mode CSS (actual broken output):**
```css
#oods-preview-root {
  background: var(--ref-color-neutral-50, #f8fafc);  /* ← light fallback, ignores theme */
  color: var(--ref-color-neutral-900, #0f172a);        /* ← always dark text */
}
```

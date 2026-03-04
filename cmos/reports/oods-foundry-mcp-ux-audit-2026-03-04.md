# OODS Foundry MCP — Full UX Audit
**Date:** 2026-03-04
**Author:** Claude Sonnet 4.6 (session mcp-audit-2026-03-04)
**Scope:** Complete end-to-end exercise of all 12 MCP tools with structured defect classification

---

## Tools Exercised

| Tool | Status |
|------|--------|
| `catalog_list` | ✅ Tested (summary, full, filters, pagination) |
| `structuredData_fetch` | ✅ Tested (manifest, tokens, components; ETag caching) |
| `tokens_build` | ✅ Tested (light preview, dark preview, hc apply) |
| `design_compose` | ✅ Tested (detail, dashboard, form, list; componentOverrides) |
| `repl_validate` | ✅ Tested (full mode with a11y, patch mode attempts) |
| `repl_render` | ✅ Tested (document mode, fragment mode) |
| `code_generate` | ✅ Tested (React/TSX, Vue SFC, HTML) |
| `brand_apply` | ✅ Tested (alias strategy; patch strategy attempted) |
| `map_create` | ✅ Tested (dry-run + apply) |
| `map_list` | ✅ Tested |
| `map_resolve` | ✅ Tested |
| `structuredData_fetch` (components) | ✅ Tested (metadata only) |

---

## Executive Summary

The OODS Foundry MCP has a solid architecture and the discovery→compose→validate→render pipeline is structurally coherent. The catalog is rich and the ETag caching, map round-trip, and fragment rendering all work as expected. However, there are **3 P0 bugs** that prevent production use (including a critical `tokens_build` regression where apply writes the wrong content), a systemic CSS mapping error affecting all generated output, and a fundamental gap in `design_compose` intent binding where domain-specific components in the catalog are invisible to the intent resolver.

---

## P0 — Critical Bugs

### BUG-01: `tokens_build apply=true` writes stub file, not compiled tokens

**Observed:** `tokens_build(brand="A", theme="hc", apply=true)` reported `exitCode: 0` and wrote `tokens.hc.json` containing only:
```json
{"brand": "A", "theme": "hc"}
```
(35 bytes). The file contains the input parameters, not compiled token values.

**Also:** The preview mode (apply=false) claims it would write 4 artifacts (`tokens.{theme}.json`, `tokens.css`, `tokens.ts`, `tokens.tailwind.json`). With apply=true, only 1 file was written, none of the CSS/TS/Tailwind variants appeared.

**Transcript audit:** The `transcript.json` contains 6 `redactions: [{field: "*", reason: "configured_string"}]` entries — every meaningful field is redacted, making the audit trail useless for diagnosing this failure.

**Impact:** Token compilation is the foundational build step. If apply=true doesn't work, nothing downstream can consume real tokens.

---

### BUG-02: CSS layout mapping — `align` always emits `align-items`, should use `justify-content` for row layouts

**Observed in:** HTML render output, React code_generate, Vue code_generate — all affected.

The DSL uses `layout: {type: "inline", align: "space-between"}` and the renderer consistently emits:
```css
align-items: space-between;  /* INVALID CSS — 'space-between' is not a valid align-items value */
```

For `align: "end"`:
```css
align-items: flex-end;  /* Wrong axis — cross-axis instead of main-axis */
```

**Correct mapping for `flex-direction: row`:**
| DSL align | Should emit |
|-----------|-------------|
| `space-between` | `justify-content: space-between` |
| `center` | `justify-content: center` |
| `end` | `justify-content: flex-end` |
| `start` | `justify-content: flex-start` |

`align-items` controls the cross-axis (vertical in row layouts). `justify-content` controls the main axis (horizontal in row layouts). Using `align-items: space-between` is invalid CSS and browsers will ignore it entirely.

**Affects:** Every `inline` layout node across all generated output formats.

---

### BUG-03: `brand_apply` RFC 6902 patch strategy is schema-blocked

**Tool description says:** "Accepts RFC 6902 patch array when strategy=patch"

**Observed:** Passing `strategy="patch"` with `delta` as a JSON array fails input validation:
```
Tool brand_apply failed: Input validation failed: field 'delta' must be object;
field 'delta' must be array; must match exactly one schema in oneOf
```

The MCP JSON schema defines `delta` as `type: object` only. Arrays are rejected by the schema validator before the handler can interpret `strategy`. The RFC 6902 patch strategy is therefore completely inoperable — advertised but blocked at the contract level.

---

## P1 — High-Impact Issues

### BUG-04: `repl_validate` patch mode requires `baseTree` even when `schemaRef` is provided

`schemaRef` is designed to reference a cached schema between tool calls, but in patch mode, providing a `schemaRef` alone results in:
```json
{"code": "MISSING_BASE_TREE", "message": "baseTree is required when mode=patch"}
```

The `schemaRef` should be usable as the implicit base tree in patch mode. As-is, users must re-pass the entire schema as `baseTree`, defeating the purpose of `schemaRef`. Additionally, the oneOf error messages from invalid patch input are contradictory (e.g., simultaneously reporting `must be array` and `must be object`).

**Hint in error response is good** — when `baseTree` is provided correctly the error message includes valid patch examples. That's a positive UX touch that should be extended to other errors.

---

### BUG-05: `design_compose` intent binding is structural-only — domain components are never selected

**Tested with:** Four distinct intents across all four layout types.

The `selections` metadata reports reasonable-sounding component names, but the actual schema tree always uses generic container nodes (`Stack`, `Card`, `Text`) as slot placeholders. Domain-specific components are never selected — despite being explicitly named in the intent.

Examples:
- `"SaaS subscription customer detail with membership panel, billing cycle progress, payment timeline..."` → every tab slot → `Card`
- `"operations dashboard with subscription metrics, revenue totals, active cancellations count..."` → metrics slot → `Card`
- `"new user registration form with address, role assignment, and tag classification"` → field slots → `Input` (not `AddressEditor`, `RoleAssignmentForm`, `TagInput`)
- `"subscription list with status badges, billing summary, cancellation indicators, tag pills"` → items slot → `Table`

The resolver maps intent terms to generic structural intents (`data-display`, `form-input`, `metrics-display`) rather than matching against catalog tags and trait names. The catalog has rich `tags` and `traits` metadata — these should be used as intent signal.

**Tab-label blindness:** With `tabLabels: ["Overview", "Billing", "Access", "Activity"]`, all four tabs receive the same intent `"data-display"` and the same `Card` selection. The tab label content (`"Billing"`, `"Access"`) should inform component selection for that tab's slot.

**componentOverrides work correctly** — when explicit overrides are provided, selections update and the reason field shows `"user override for slot..."`. The metadata reflects overrides accurately. However, overridden components are still not placed in the schema tree (see BUG-06).

---

### BUG-06: `componentOverrides` selections are not materialized in the schema tree

When `componentOverrides` are provided in `design_compose` preferences, the `selections` array correctly shows the overridden components. But the schema tree is not updated — slot nodes remain as generic `Stack` containers.

Consequently, `code_generate` on a schema with componentOverrides only imports and renders the generic components (`Stack`, `Card`, etc.), completely ignoring the overrides. The override feature has no effect on generated code.

---

### BUG-07: A11Y token defect — `sys.text.muted` fails WCAG AA on default canvas

`repl_validate(checkA11y=true)` reported:
```
sys.text.muted on sys.surface.canvas fails WCAG AA — contrast ratio 2.68:1, minimum 4.5:1 required.
```

Ratio 2.68:1 is substantially below the 4.5:1 minimum. This is a token design defect in the base system (not just a usage warning). The muted text color needs to be darkened to achieve compliance.

---

## P2 — Data Quality Issues

### DQ-01: `StatusBadge` has duplicate traits in catalog

```json
"traits": ["Stateful", "Stateful", "Statusable", "Statusable", "Statusable"]
```

Three duplicates. Should be `["Stateful", "Statusable"]`. Affects trait-based filtering, component-to-trait mapping, and any downstream deduplication logic.

---

### DQ-02: Communication components have empty `regions` array

`CommunicationDetailPanel`, `MessageEventTimeline`, `MessageStatusBadge`, and `TemplatePicker` all have `"regions": []`. These components cannot be placed by any region-based layout logic. Either the regions data is missing or these components genuinely have no region constraints — if the latter, the empty array should be documented as "region-agnostic".

---

### DQ-03: Catalog stats are global when filtered

When filtering `catalog_list(category="financial")` which returns 10 components, `stats.componentCount` still shows `94`. The stats block is always global, making it confusing when the caller is working with a filtered view.

**Suggestion:** Add `filteredCount` alongside `componentCount` in the stats block, or scope `stats` to the filtered result.

---

## P3 — UX and DX Friction

### UX-01: `repl_render` and `code_generate(framework="html")` are identical

Both return a complete 84–93KB HTML document with the full token CSS stylesheet inlined. This is not obvious from the tool descriptions. `code_generate(framework="html")` should either return a standalone component fragment (no full document boilerplate, no inlined tokens) or the tool description should explicitly state it's equivalent to `repl_render(format="document")`.

The 84KB output size for a 15-node schema is impractical for agent-to-agent use. The token stylesheet alone is ~80KB. Consider a `includeCss: false` option for `code_generate` analogous to `repl_render`.

---

### UX-02: Slot placeholders render as invisible empty divs

Unfilled slot nodes render as `<div data-oods-label="tab-0"></div>` — completely empty. A developer previewing the wireframe has no visual signal for what should populate each slot. Placeholder content (e.g., a label, dashed border, or aria-label) would make the preview wireframe meaningful without affecting production output.

**Comparison:** The `meta.label` field exists on every slot node — it just isn't rendered.

---

### UX-03: Tabs renders without tab navigation affordance

The `Tabs` component in HTML render output has no tab header or navigation controls — the tab panels are simply stacked divs:
```html
<section data-oods-component="Tabs">
  <div data-prop-label="Overview">...</div>
  <div data-prop-label="Billing">...</div>
</section>
```

No tab list, no tab buttons, no visible panel switching. The preview is misleading for any layout using tabs. The Tabs renderer should at minimum generate a tab bar with the panel labels as buttons.

---

### UX-04: `tokens_build` same-day transcript path collision across themes

Light theme and dark theme builds on the same day share `artifacts/current-state/{date}/tokens.build/transcript.json`. Running multiple theme builds sequentially means each overwrites the previous transcript. Consider namespacing by theme: `tokens.build/{theme}/transcript.json`.

---

### UX-05: `brand_apply` `before` value is always empty in diffs

The `diffs[].structured.before` field is always `{}` even when overwriting existing token values. This makes the diff useless for understanding what was changed:
```json
"before": {},
"after": {"primary": "--color-brand-500"}
```

For an alias strategy targeting existing tokens, the before state should show the current token value.

---

### UX-06: `schemaRef` 30-minute TTL is short for iterative workflows

A `schemaRef` expires 30 minutes after creation. If a developer composes a schema, reviews it, and then returns to generate code, the ref may have expired. Either extend the TTL (e.g., 2 hours), or surface the expiry in tool responses so callers can detect and re-compose when needed (currently `schemaRefExpiresAt` is returned on compose but not on validate/render errors).

---

### UX-07: `map_create` dry-run returns etag for unapplied state

When `apply=false`, `map_create` returns an `etag` field. This etag represents the current (unchanged) state of `component-mappings.json` — not the state that would result from applying the mapping. This is correct behavior but surprising: the etag reads as "here is your mapping's identity" when it actually means "here is the current file hash, which this dry run didn't change."

---

### UX-08: `repl_validate` patch mode `appliedPatch: true` is misleading when patch path is missing

When a patch path doesn't exist in the baseTree, `repl_validate` returns both an error (`PATCH_PATH_MISSING`) and `appliedPatch: true`. Applied = true should mean the patch succeeded; when it fails, that field should be `false` or absent.

---

## What Works Well

1. **Catalog discovery is excellent.** Rich metadata per component: traits, tags, contexts, regions, propSchema with trait attribution, and code references (storybook snippets). This is highly agentic — an agent can reliably select components from intent.

2. **ETag caching works correctly.** `structuredData_fetch` with `ifNoneMatch` correctly returns `matched: true` and omits payload on cache hit. Clean implementation across all datasets.

3. **Fragment render mode is a strong feature.** `repl_render(format="fragments")` returns per-node HTML with `cssRefs` for CSS dependency tracking. This is ideal for incremental rendering and SSR. The fragment output is compact and practical.

4. **`brand_apply` alias strategy is clear.** The preview diffs are structured (before/after), theme-aware (base/dark/hc), and the hunks format is readable. Applying across all three themes in one call is convenient.

5. **`design_compose` structural scaffolding is fast and correct.** Layout templates (detail, dashboard, form, list) produce well-structured, valid schemas instantly. The sidebar/main split, tab panel grouping, toolbar pattern, and form field groups are all correct structural starting points.

6. **`map_create` / `map_list` / `map_resolve` round-trip is clean.** Create, persist, and look up component mappings works without errors. The `propTranslations` field in resolve gives actionable prop name conversions.

7. **`repl_validate` checkA11y is actionable.** The contrast failure message includes the specific token pair, the measured ratio, and the minimum required — exactly what a developer needs to fix it.

8. **Pagination on `catalog_list` is correct.** `page`/`pageSize` parameters work, `hasMore` and `returnedCount` fields are accurate, `totalCount` is always present.

9. **`componentOverrides` correctly documents selections.** Even though overrides don't materialize in the tree (BUG-06), the selections metadata accurately reflects them with `"reason": "user override for slot..."`.

10. **`structuredData_fetch` metadata is useful.** The `meta` block on components returns `{componentCount, traitCount, objectCount, domainCount, patternCount}` — at-a-glance counts that don't require fetching the 439KB payload.

---

## OODS Object/Trait Observations

Beyond the MCP tooling itself, several observations about the underlying OODS catalog:

1. **`Billable` and `Priceable` are distinct traits** with some overlap in purpose (both deal with money). The distinction (subscription cycle vs. unit price) is clear from propSchema but not from tag sets — both share `billing` and `financial` tags. Consider adding a distinguishing tag (`subscription` only for Billable, `pricing` only for Priceable).

2. **`Authable` trait naming** is unusual — "Authable" sounds like it could mean "authenticatable" but it actually means authorization/membership (RBAC). `Authorizable` or `MembershipAware` would be less ambiguous.

3. **`Communicable` components have no regions.** This means they can't be placed by layout engine. If these components are genuinely region-agnostic (can appear anywhere), an explicit `regions: ["*"]` or a documented convention would be clearer than an empty array.

4. **VizRoleBadge has 4 traits** (`MarkArea`, `MarkBar`, `MarkLine`, `MarkPoint`) — it's a multi-role display badge. This is the only component with more than 2 traits. The multi-trait pattern works but is worth documenting as a design pattern for other "summary" components.

5. **No `Searchable` or `Filterable` traits despite list layout using Input/Select for search/filter.** These are common behavioral patterns that could benefit from trait encoding.

---

## Priority Fix Order

| Priority | Item | Effort |
|----------|------|--------|
| P0 | BUG-01: `tokens_build apply=true` writes stub | High — investigate build pipeline |
| P0 | BUG-02: CSS `align-items` vs `justify-content` for row layouts | Low — fix layout→CSS mapping table |
| P0 | BUG-03: `brand_apply` patch strategy schema-blocked | Low — update `delta` schema to accept array |
| P1 | BUG-04: `repl_validate` patch requires `baseTree` with `schemaRef` | Medium — resolve schemaRef in patch mode |
| P1 | BUG-05: `design_compose` intent binding — catalog tags not used | High — semantic intent→tag matching |
| P1 | BUG-06: `componentOverrides` not materialized in tree | Medium — write override component into slot node |
| P1 | BUG-07: A11Y token — `sys.text.muted` contrast 2.68:1 | Low — adjust muted text OKLCH lightness |
| P2 | DQ-01: `StatusBadge` duplicate traits | Low — deduplicate in source data |
| P2 | DQ-02: Communication component empty regions | Low — audit and fill or document |
| P2 | DQ-03: Global stats when filtering catalog | Low — scope stats to filter result |
| P3 | UX-01: `code_generate(html)` = `repl_render` — clarify or differentiate | Low |
| P3 | UX-02: Slot placeholder rendering | Low — render label as placeholder content |
| P3 | UX-03: Tabs renders without navigation | Medium — add tab bar to Tabs renderer |
| P3 | UX-04: Transcript path collision across themes | Low — namespace by theme |
| P3 | UX-05: `brand_apply` before-state always empty | Medium — capture current token values before write |
| P3 | UX-06: `schemaRef` 30-min TTL | Low — extend or surface expiry clearly |
| P3 | UX-07: Dry-run etag is confusing | Low — omit etag on unapplied dry-runs |
| P3 | UX-08: `appliedPatch: true` on failed patch | Low — set false when patch errors |

---

## Test Artifacts Produced

The following schemas were composed during this session and may be useful as test fixtures:

- `compose-594de5ac` — Detail layout, 4 tabs (Overview/Billing/Access/Activity), SaaS customer
- `compose-663d6682` — Dashboard layout, 4 metric columns, ops monitoring
- `compose-9dffae7b` — Detail layout, 3 tabs with componentOverrides (PreferencePanel, CycleProgressCard, MembershipPanel)
- `compose-da1937fe` — Form layout, 3 field groups, user registration
- `compose-3b506c1e` — List layout, search/filter/pagination toolbar, subscription list

Note: All refs expire 30 minutes from compose time. Persist via `repl_render(apply=true)` or `code_generate` if you need durable artifacts.

---

*Report generated by direct MCP tool invocation — all findings are from live tool responses, not inference.*

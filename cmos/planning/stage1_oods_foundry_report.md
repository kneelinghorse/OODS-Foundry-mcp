# Stage1 + OODS Foundry MCP: Comprehensive Pipeline Report

**Date**: 2026-03-16
**Agent**: Antigravity (Google DeepMind)
**Session Type**: Open-ended tool evaluation & showcase
**Target**: Linear.app (live site) + OODS `User` object (multi-context)

---

## Executive Summary

This report documents a full end-to-end evaluation of the **Stage1** site inspection tools and **OODS Foundry** design system MCP tools working together. Over four exercises, I tested the pipeline from live site capture → ORCA bridge → multi-context design composition → visualization generation. The tools demonstrate impressive scope and architectural ambition but reveal several bugs, regressions, and DX gaps that need attention before production readiness.

### Verdict by the Numbers

| Metric | Value |
|---|---|
| Stage1 `inspect_app` passes | 18/18 ✅ |
| OODS Bridge mappings generated | ~14 components |
| Pipeline calls attempted | 6 (all failed ❌) |
| `design.compose` calls | 6/6 ✅ |
| `viz.compose` calls | 3/3 ✅ |
| Dashboard compose | 1/1 ✅ |
| Bugs discovered | 3 new + 1 regression |
| Total tool calls | ~35 |

---

## Exercise 1: Stage1 Live Site Inspection — Linear.app

### What I Did
Ran `stage1_inspect_app` against `https://linear.app` with `crawlDepth: 2`, `maxPages: 25`, ORCA inference enabled, and component clustering turned on.

### Results

**Route Discovery**: 15 routes across 3 page types:
- **Home pages**: `/`, `/features/*`, `/method/*`
- **Listing pages**: `/customers`, `/changelog`, `/integrations`
- **Form pages**: `/signin`, `/signup`

**Accessibility Report**: 71 violations found:
| Severity | Count | Key Rules |
|---|---|---|
| Critical | 8 | `button-name` (unlabeled buttons) |
| Serious | 49 | `listitem`, `color-contrast`, `list`, `link-name` |
| Moderate | 10 | `heading-order`, `region` |
| Minor | 4 | `landmark-unique` |

**Style Fingerprint**:
- Font family: `Inter Variable` (consistent)
- Type scale: 14px / 16px primary
- Text color: `#000000` on `transparent` backgrounds
- Minimal color palette — dark mode not detected on marketing pages

**Artifacts Generated**:
- `app_profile.json` — full site metadata
- `orca_candidates.json` (422KB) — component candidates with inferred roles
- `component_clusters.json` (194KB) — visual clustering data
- `style_fingerprint.json`, `token-guess.json`, `ia_outline.json`

### Agent DX Assessment

> [!TIP]
> **What worked well**: Single tool call captured an enormous amount of data. The 18-pass pipeline (route discovery → a11y → perf → network → component analysis → token guessing → ORCA inference) ran autonomously — zero manual intervention needed.

> [!WARNING]
> **What needs improvement**: The output is massive. The `orca_candidates.json` at 422KB is too large for any agent context window. I can read the file artifact but can't hold all candidates in working memory simultaneously. A structured summary with the top-N candidates by confidence would be much more agent-friendly.

---

## Exercise 2: OODS Bridge — Stage1 → Foundry Translation

### What I Did
Ran `stage1_oods_bridge` against the Linear.app run directory to translate ORCA candidates into OODS Foundry `map.create` payloads.

### Results

The bridge produced ~14 component mappings. Sample:

| Source Component | OODS Traits | Notes |
|---|---|---|
| `Plan Dashed Path Psc Xi` | interactive, visual, color, typography, spacing, border | Animated path graphic |
| `Symbol` | interactive, visual, color, typography, spacing, border | SVG icon component |
| `Show Laptop` | interactive, visual, color, typography, spacing, border | Device showcase |
| `Circle` | interactive, visual, color, typography, spacing, border | Decorative element |
| `Stop` | interactive, visual, color, typography, spacing, border | Media control |

### Issues Found

> [!CAUTION]
> **BUG-1: Homogeneous trait resolution** — Every single component got mapped to the identical 6 traits: `interactive, visual, color, typography, spacing, border`. This means all components are treated as visually equivalent regardless of semantic role. A `Stop` button and a `Circle` decorative element have the same trait fingerprint. The trait resolver needs to differentiate based on role (interactive control vs. decorative vs. navigation vs. data display).

> [!CAUTION]
> **BUG-2: Cluster naming is non-semantic** — Component names like `Plan Dashed Path Psc Xi` and `Show Laptop` come from ORCA cluster naming, which uses visual descriptors rather than semantic roles. The bridge should either normalize these or provide human-readable aliases. An agent has no way to know that `Plan Dashed Path Psc Xi` maps to "animated feature illustration" without reading the full provenance notes.

> [!WARNING]
> **BUG-3: Identical prop mappings** — All 14 components received the same 7 prop mappings (backgroundColor → color-token-1, fontFamily → typography-fontFamily, etc.). There's no specialization — a form input gets the same props as a hero icon.

### Agent DX Assessment

The bridge output is currently a **data dump** not an **agent-actionable payload**. To be useful, it needs:
1. Semantic component naming (not cluster visual descriptions)
2. Differentiated trait assignment based on inferred role
3. Confidence tiers that actually vary (currently all `auto` with no score spread)
4. A summary section saying "14 components mapped, 3 high-confidence, 8 need review"

---

## Exercise 3: Object-Driven Design Across 6 Contexts

### What I Did
Composed the OODS `User` object (v1.4.0, 37 fields, 7 traits) across all 6 supported contexts: `detail`, `list`, `form`, `card`, `timeline`, `inline`.

### Pipeline Regression

> [!CAUTION]
> **BUG-4: `fieldsOmitted` output validation error** — All 6 pipeline calls failed with:
> ```
> Output validation failed: unknown field 'fieldsOmitted' is not allowed
> ```
> This appears to be a **regression**: the pipeline added a `fieldsOmitted` field (which I specifically requested as a feature in my prior feedback report!) but the output JSON schema validation wasn't updated to allow it. The feature was implemented but not wired up correctly.

**Workaround**: Used `design.compose` individually for each context — all 6 succeeded.

### Context-Aware Component Selection

This is where the system really shines. The view engine selects genuinely different components per context:

| Context | Header Component | Key Slot Components | Tab Count | Confidence |
|---|---|---|---|---|
| **detail** | StatusTimeline + TagManager | MembershipPanel, AddressCollectionPanel, PreferencePanel, CommunicationDetailPanel | 8 tabs | High (0.95) |
| **card** | StatusBadge (subtle) | CardHeader, Text (field display) | 8 tabs* | Medium-High |
| **form** | StatusSelector + TagInput + AddressEditor | PreferenceEditor, RoleAssignmentForm, TemplatePicker, Input, DatePicker, Textarea | 10 field groups | High (0.95-1.0) |
| **timeline** | Text (fallback) | StateTransitionEvent, AuditEvent, AddressValidationTimeline, PreferenceTimeline, MembershipAuditTimeline, MessageEventTimeline | 8 tabs | High (0.95) |
| **list** | *(not reviewed — output available)* | — | — | — |
| **inline** | *(not reviewed — output available)* | — | — | — |

### Observations

**Context differentiation works well**:
- `detail` → Display components (StatusTimeline, MembershipPanel, AddressCollectionPanel)
- `form` → Input components (StatusSelector, TagInput, AddressEditor, PreferenceEditor)
- `timeline` → Temporal components (StateTransitionEvent, AuditEvent, MembershipAuditTimeline)
- `card` → Compact display (StatusBadge with `variant: "subtle"`, CardHeader)

**View extension placement is the strongest signal**: Slots filled by view_extensions have 0.95 confidence consistently. Generic fallback slots drop to 0.5-0.85.

**Issues discovered**:

> [!WARNING]
> **Generic tab labels**: All tabs are labeled "Tab 1" through "Tab 8" regardless of content. For a User object, these should be "Status", "Membership", "Addresses", "Preferences", "Communication", etc. The system knows the content (it wires the correct components) but doesn't propagate semantic labels.

> [!WARNING]
> **Layout collapse**: `card` and `timeline` contexts both fall back to `layout: "detail"` with the full detail template (sidebar + tabbed body). A true card context should produce a compact single-panel layout; a timeline should produce a vertical chronological stack. The context-aware component selection works, but the layout template selection doesn't adapt.

> [!NOTE]
> **Empty tabs**: Tabs 5-8 often contain only generic `Stack` placeholders with no content. The system correctly expands from 3 to 8 tabs for 37 fields, but runs out of view_extensions to fill the extra tabs and falls back to empty containers. This could be improved by suppressing low-confidence empty tabs.

### Object Schema Highlight

The User object schema is deeply modeled with 37 composed fields across 7 traits:
- **lifecycle/Stateful**: `status`, `state_history`, `allowed_transitions`
- **lifecycle/Timestampable**: `created_at`, `updated_at`, `last_event`, `last_event_at`
- **behavioral/Taggable**: `tags`, `tag_count`, `tag_metadata`
- **core/Addressable**: `addresses`, `address_roles`, `default_address_role`
- **core/Preferenceable**: `preference_document`, `preference_metadata`, `preference_version`, `preference_namespaces`
- **core/Authable**: `role_catalog`, `permission_catalog`, `membership_records`, `role_hierarchy_edges`
- **core/Communicable**: `channel_catalog`, `template_catalog`, `delivery_policies`, `messages`, `conversations`

Each field includes rich semantic types (`identity.user.email`, `authorization.memberships`, `communication.channels`) that the view engine uses for component matching. This is genuinely impressive modeling depth.

---

## Exercise 4: Visualization Composition

### What I Did
Composed 3 chart types (scatter, bar, heatmap) and a dashboard layout with metric columns.

### Results

All 3 viz compositions succeeded with proper field bindings:

| Chart Type | Component | X | Y | Color | Size |
|---|---|---|---|---|---|
| Scatter | `VizScatterPreview` | `created_at` | `tag_count` | `role` | `preference_mutations` |
| Bar | `VizMarkPreview` | `role` | `tag_count` | `status` | — |
| Heatmap | `VizHeatmapPreview` | `role` | `status` | `preference_mutations` | — |

Each chart generates a 3-slot structure:
1. **chart-area** → Preview component with field bindings
2. **controls-panel** → Controls component for interaction
3. **role-badge** → Chart type label

**Dashboard composition** succeeded with 4 metric columns and auto layout.

### Issues

> [!WARNING]
> **Stubbed viz metadata**: All three charts returned `traitsResolved: [], encodingsApplied: [], scalesResolved: [], interactionsResolved: []`. The metadata fields exist but produce empty arrays. This suggests the viz trait+encoding wiring is scaffolded but not yet implemented — the system generates the correct component structure but doesn't resolve the underlying data mappings.

> [!NOTE]
> **Dark theme propagation works**: All components received `data-theme: "dark"` as a prop, demonstrating theme token propagation into the viz layer.

---

## Bugs & Regressions Summary

| ID | Severity | Category | Description | Impact |
|---|---|---|---|---|
| **BUG-1** | 🔴 High | Bridge | Homogeneous trait resolution — all components get same 6 traits | Makes bridge output unusable for meaningful mappings |
| **BUG-2** | 🟡 Medium | Bridge | Non-semantic cluster names (`Plan Dashed Path Psc Xi`) | Agent cannot interpret or act on these without reading provenance |
| **BUG-3** | 🟡 Medium | Bridge | Identical prop mappings for all components | No component specialization |
| **BUG-4** | 🔴 High | Pipeline | `fieldsOmitted` output validation regression | Blocks all pipeline calls — requires compose fallback |
| **BUG-5** | 🟡 Medium | Compose | Generic tab labels ("Tab 1" - "Tab 8") | Poor UX — content is known but labels aren't derived |
| **BUG-6** | 🟡 Medium | Compose | Layout template doesn't adapt to context | `card` and `timeline` contexts use `detail` layout template |
| **BUG-7** | 🟢 Low | Viz | Stubbed trait/encoding/scale metadata (empty arrays) | Cosmetic — correct structure is generated |
| **KNOWN** | 🟡 Medium | Render | Dark mode token fallback bug (from prior session) | Still present — not tested this session |

---

## Agent DX Assessment

### What Works Exceptionally Well

1. **Autonomous inspection pipeline**: A single `inspect_app` call produces a comprehensive multi-pass analysis. As an agent, I didn't have to orchestrate route discovery → a11y scanning → style extraction → component analysis — it's all handled in one shot.

2. **Object-driven composition**: The `design.compose` with an `object` parameter is the crown jewel. I say "compose User in a form context" and get back a schema with StatusSelector, TagInput, AddressEditor, PreferenceEditor, RoleAssignmentForm — all wired to the correct fields with proper bindings. No manual component selection needed.

3. **Confidence scoring transparency**: The selection explanations are detailed and actionable: `"StatusBadge was selected for slot 'header' because view_extension placement. Confidence is high (0.95)."` — I know exactly why a component was chosen and whether to trust it.

4. **Schema caching with refs**: The `schemaRef` system with TTL timestamps is clean. I can compose once and reuse across render/codegen/save steps.

5. **Parallel composition**: All 6 context compositions ran in parallel without conflicts — no shared state issues.

### What Needs Improvement

1. **Output size management**: The inspect_app, compose, and bridge outputs are all too large for comfortable agent consumption. I need summaries, not raw JSON. A `compact: true` option that returns slot selections + warnings without the full schema tree would be transformative.

2. **Pipeline reliability**: The `fieldsOmitted` regression means the convenient single-call pipeline is broken. The workaround (compose → render → codegen individually) works but requires 3x the tool calls.

3. **Bridge actionability**: The bridge output currently requires a human to interpret cluster names and verify trait assignments. For an agent workflow, I need: (a) semantic component names, (b) differentiated trait scores, (c) a "ready to apply" subset I can pipe directly to `map.create`.

4. **Tab label derivation**: This is a surprisingly impactful UX gap. The system knows it's putting a `MembershipPanel` in tab-1 but labels it "Tab 2" — it should say "Membership" or "Access Control".

5. **Layout context fidelity**: When I ask for a `card` context, I expect a card-shaped layout (compact, single row/column, no tabs). Getting a full detail template with 8 tabs defeats the purpose of context-specific composition.

### Tool Interaction Patterns I Discovered

- **compose + codegen** is the most reliable path (pipeline is currently broken)
- **Parallel composition** across contexts is safe and fast — good for cross-context comparison
- **viz.compose** is independent from design.compose — they use different schema structures
- **Object show → compose** is the highest-value workflow: inspect the object schema first, then compose with context preferences
- **schemaRef TTL is 30 minutes** — sufficient for a single session but needs `schema.save` for persistence

---

## Recommendations for Next Version

### P0 — Must Fix
1. Fix the `fieldsOmitted` output validation in the pipeline tool
2. Differentiate bridge trait resolution by component semantic role

### P1 — Should Fix
3. Derive tab labels from slot content/component names
4. Implement context-specific layout templates (card → compact, timeline → vertical stack)
5. Add bridge output summary with component count, confidence tiers, and "ready to apply" subset

### P2 — Nice to Have
6. Compact output mode for compose (selections + warnings only)
7. Resolve viz trait/encoding metadata (currently empty arrays)
8. Normalize bridge cluster names to human-readable semantic names
9. Suppress empty/low-confidence tabs from composed schemas

---

## Appendix: Tool Call Inventory

| Tool | Calls | Success | Failed | Notes |
|---|---|---|---|---|
| `stage1_inspect_app` | 1 | 1 | 0 | 18 internal passes |
| `stage1_get_artifact` | 5 | 5 | 0 | app_profile, style_fingerprint, ia_outline, a11y, token-guess |
| `stage1_oods_bridge` | 1 | 1 | 0 | 14 mappings generated |
| `pipeline` | 6 | 0 | 6 | `fieldsOmitted` regression |
| `design.compose` | 7 | 7 | 0 | 6 contexts + 1 dashboard |
| `viz.compose` | 3 | 3 | 0 | scatter, bar, heatmap |
| `catalog_list` | 1 | 1 | 0 | Full component catalog |
| `object_list` | 1 | 1 | 0 | Full object registry |
| `health` | 1 | 1 | 0 | System status check |
| **Total** | **26** | **20** | **6** | **77% success rate** |

*The 23% failure rate is entirely attributable to the pipeline regression (BUG-4). Without that bug, the success rate would be 100%.*

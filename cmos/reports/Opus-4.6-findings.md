# OODS Foundry MCP — Agent UX Feedback Report

**Agent:** Claude Code (Opus 4.6, Claude Agent SDK / VSCode extension)
**Date:** 2026-03-04
**Session type:** End-to-end build test + agent experience review
**Built:** User account detail view with tabbed layout (Overview, Billing, Activity, Settings)
**Output:** `/OODS-testing/GeneratedDetailView.tsx`

---

## Executive Summary

The OODS Foundry MCP toolchain is one of the most thoughtfully designed agent-facing APIs I've encountered. The governance loop (discover → compose → validate → render → generate) is conceptually excellent, and several tools deliver genuinely useful output that I wouldn't get from generic code generation. However, the pipeline has meaningful friction for agent workflows that, if addressed, would make the tool dramatically more effective. The biggest issues are: **schema passthrough overhead**, **response verbosity**, and **a few output bugs**.

---

## What I Built

A user account detail page with:
- Tabbed layout (Overview, Billing, Activity, Settings)
- Sidebar metadata panel
- Header with inline layout
- Generated both React TSX and Vue SFC outputs
- Applied an indigo + dark surface brand overlay
- Ran WCAG A11Y contrast checks

---

## Tools Tested (10 of 11 auto-registered)

| Tool | Tested | Verdict |
|------|--------|---------|
| `catalog.list` | Yes | Good with filters, overflows without |
| `design.compose` | Yes | Good structure, weak intent parsing |
| `repl.validate` | Yes (full + patch) | Full mode excellent, patch mode broken |
| `repl.render` | Yes | Returns JSON not HTML — misleading |
| `code.generate` | Yes (React + Vue) | Vue good, React has syntax bug |
| `brand.apply` | Yes (preview) | Comprehensive but extremely verbose |
| `tokens.build` | Yes (preview) | Returns empty in preview mode |
| `structuredData.fetch` | Yes (manifest) | Clean, well-structured |
| `map.list` | Yes | Empty (expected), no guidance |
| `map.create` / `map.resolve` | No | — |

---

## What Works Well

### 1. catalog.list with filters is excellent
Filtering by category, trait, or context works well. The output structure is rich — component names, prop schemas with trait attribution, slot definitions, rendering contexts, AND real code snippets from Storybook. This is the tool's killer feature. An agent that reads this can write correct component usage on the first try without hallucinating prop names.

**Specific praise:** The `codeReferences` array with Storybook paths and snippets is a better "Code Connect" than most design system tooling offers. Trait attribution on props (`"trait": "Statusable"`) tells me exactly where each prop comes from.

### 2. repl.validate with A11Y checks catches real issues
With `checkA11y: true`, validation caught that `sys.text.muted` on `sys.surface.canvas` has a contrast ratio of 2.68:1, below the WCAG AA minimum of 4.5:1. That's not a theoretical warning — that's a real accessibility bug in the dark theme tokens. The error format (code, message, hint, severity) is well-structured for programmatic handling.

### 3. design.compose respects preferences
It correctly used my tab labels, tab count, and layout type. The auto-validation built into compose output is a nice touch — I didn't have to call validate separately to know the schema was valid.

### 4. brand.apply preview is audit-grade
The before/after structured diff showing every theme file (base, dark, hc) that would change is exactly what a design ops team needs. The specimen data URIs are a clever touch for visual validation.

### 5. structuredData.fetch is well-designed
ETag caching, date-versioned artifacts, manifest with file sizes. This is how structured data endpoints should work. The version pinning via `YYYY-MM-DD` format is predictable and clean.

### 6. Vue code generation is clean
The Vue SFC output had proper `<script setup lang="ts">`, inline styles as strings (which works natively in Vue templates), and clean component imports. Of the two framework outputs, Vue was ready to use as-is.

---

## What Needs Improvement

### CRITICAL: Schema passthrough between tools is painful

This is the single biggest agent UX issue. The compose → validate → render → generate pipeline requires passing the **full UiSchema JSON** as input to each subsequent tool. For my 15-node tree, this meant copying ~2KB of JSON four times. For a larger schema, this would be 10-20KB repeated across 4 tool calls.

**Impact:** Consumes agent context window, creates opportunities for copy errors, and makes the pipeline feel fragmented rather than fluid.

**Suggestion:** Either:
- (a) Add a `design.pipeline` tool that chains compose → validate → render → generate in a single call with step flags
- (b) Implement server-side schema caching where compose returns a `schemaId` that subsequent tools accept as shorthand (e.g., `{ "schemaRef": "compose-abc123" }`)
- (c) At minimum, have render and code.generate accept the compose output directly (they could extract `.schema` from the compose response shape)

**Priority:** CRITICAL — this affects every multi-step workflow

### HIGH: code.generate (React) has a syntax bug

The React TSX output contains triple curly braces for style objects:

```tsx
style={{{ display: 'flex', flexDirection: 'column' }}}
```

This should be:

```tsx
style={{ display: 'flex', flexDirection: 'column' }}
```

Triple braces are invalid JSX and will cause a compile error. The Vue output doesn't have this issue because it uses string-based inline styles.

**Impact:** The generated React code cannot be used without manual correction. For an agent workflow, this means I need to post-process every generated React file.

**Priority:** HIGH — this is a regression/bug, not a design issue

#### Update (2026-03-04): React triple-brace regression verified closed

**Root cause (historical):** The style emitter previously double-wrapped an already-braced style object, producing `style={{{ ... }}}`. The current emitter builds a single-brace object string and wraps it once as `style={{ ... }}`, which is valid JSX.

**Verification:** On current head, the adapter path no longer reproduces triple braces. Added parity/guard tests to lock behavior for both React and Vue outputs:
- `packages/mcp-server/test/contracts/code.generate-parity.spec.ts`
- `packages/mcp-adapter/test-s57-m05.js`

### HIGH: repl.render returns JSON, not HTML

The demo showcase document describes render as producing "render-ready output" and the tool description says "Render a validated UiSchema into HTML/CSS preview output." But the actual response just echoes the UiSchema tree as JSON with a summary string. There's no HTML, no CSS, and no visual preview.

**Impact:** The "render" step in the pipeline feels redundant — it returns essentially the same data as validate. The tool name creates an expectation it doesn't meet.

**Suggestion:** Either:
- (a) Actually emit HTML + CSS (even if simplified/static)
- (b) Rename to `repl.preview` and adjust the description to match the actual behavior
- (c) Add a `format: "html"` option that generates markup

**Priority:** HIGH — misleading tool contract

### HIGH: catalog.list without filters overflows context

Calling `catalog.list` with no parameters produced 134,761 characters — far too large for any agent context window. My tool framework had to save it to disk instead of returning it inline.

**Impact:** An agent's natural first move is to call `catalog.list` to see what's available. Getting a 134K response that truncates or errors is a bad first experience.

**Suggestion:**
- (a) Add a `summary: true` mode that returns just component names and trait lists (no code snippets, no full prop schemas)
- (b) Add pagination (`offset`/`limit` parameters)
- (c) Default to summary mode when no filters are provided, with a note about how to get full details

**Priority:** HIGH — first-contact UX issue for every new agent

### MEDIUM: design.compose doesn't parse per-slot intent

My intent description was: "User account detail page with profile info, subscription billing status, role badges, activity timeline, and preference settings in a tabbed layout"

But all 4 tab slots received the same generic `"data-display"` intent with `Card` selected. The composer didn't differentiate between:
- Tab 0 (Overview) → should match profile/status components
- Tab 1 (Billing) → should match Billable/Priceable trait components
- Tab 2 (Activity) → should match timeline components
- Tab 3 (Settings) → should match Preferenceable trait components

**Impact:** The compose output is structurally correct but semantically generic. An agent still needs to manually replace slot components with domain-specific ones.

**Suggestion:**
- Parse intent keywords per slot (e.g., "billing" → filter candidates by Billable/Priceable traits)
- Use tab labels as intent hints for child slot selection
- Include the original intent keywords in the slot's `meta` so the agent can at least see what was intended

**Priority:** MEDIUM — the structure is usable, but more intelligent slot matching would be transformative

### MEDIUM: repl.validate patch mode silently fails

Calling `repl.validate` with `mode: "patch"`, a `baseTree`, and a `patch` object returned `"Input validation failed"` with no additional context.

**Impact:** I couldn't test incremental updates. The error message doesn't tell me what format the patch parameter expects (RFC 6902 array? Single operation? Different shape entirely?).

**Suggestion:**
- Return structured validation errors explaining which parameter failed and why
- Include an example patch format in the error message or tool description
- The tool description says "patch" mode exists but doesn't document the expected `patch` parameter shape

**Priority:** MEDIUM — patch mode is documented but unusable without format guidance

### MEDIUM: brand.apply preview response is enormous

The preview response for my 4-token delta was over 30KB because it includes the **complete before/after** of every theme file (base.json, dark.json, hc.json), even for tokens that didn't change.

**Impact:** Most of the response is noise — unchanged tokens that the agent needs to scan past to find the actual changes.

**Suggestion:**
- (a) Only include changed tokens in the diff (the `hunks` array already does this correctly — the `structured.before/after` is the problem)
- (b) Add a `verbose: false` option that returns only hunks without full file contents
- (c) Move the full structured diff to an artifact file and return just the summary + hunks inline

**Priority:** MEDIUM — the data is correct but the signal-to-noise ratio is low

### LOW: tokens.build returns empty artifacts in preview mode

Calling `tokens.build` with `apply: false` returned `"artifacts": []` with only transcript/bundle paths. No preview of CSS variables, no token count, no build summary.

**Impact:** Preview mode is useless — it doesn't preview anything. An agent can't know what the build would produce without committing to `apply: true`.

**Suggestion:** Return artifact contents (or at least names and sizes) in preview mode, similar to how brand.apply returns a full diff preview.

**Priority:** LOW — tokens.build is typically a build step, not a query step

### LOW: Searchable trait filter returns 0 results

`catalog.list({ trait: "Searchable" })` returned empty despite the catalog containing searchable components. Either the trait name is wrong or the filter logic doesn't match.

**Impact:** Agent has to guess trait names. No error or "did you mean?" suggestion is provided.

**Suggestion:** When a trait filter returns 0 results, suggest available trait names that are close matches.

**Priority:** LOW — minor discovery friction

---

## Agent Workflow Observations

### What an ideal agent workflow looks like

1. `catalog.list` (summary mode) → understand what's available
2. `design.compose` → generate schema from intent
3. Schema auto-validates (already built into compose)
4. `code.generate` → emit framework code
5. `brand.apply` → theme it

That's 4 calls. Today it's 4-6 calls with the same schema passed each time.

### Context window impact

A full compose → validate → render → generate cycle consumed approximately:
- ~2KB schema x 4 passes = ~8KB of redundant schema data
- catalog.list (filtered) responses: ~5-15KB each
- brand.apply preview: ~30KB
- Total for my modest test: ~60-80KB of MCP responses

For an agent with a 200K context window, this is manageable. For smaller context agents or longer sessions, it adds up fast.

### Comparison with Cursor's experience

Cursor generated a dashboard layout (`GeneratedDashboard.tsx`). Comparing our outputs:
- Both produced valid structural scaffolding with correct token references
- Both had empty slots that need manual population
- Cursor's output was simpler (no tabs, no sidebar) but used the same component patterns (Stack, Grid, Card, Text)
- The React triple-brace bug appears in Cursor's output too (`style={{{ ... }}}`), confirming it's a server-side issue, not a client issue

---

## Recommendations Summary

| Priority | Issue | Fix |
|----------|-------|-----|
| CRITICAL | Schema passthrough overhead | Add pipeline tool or server-side schema caching |
| HIGH | React code.generate syntax bug (triple braces) | Fix template string escaping |
| HIGH | repl.render returns JSON not HTML | Emit actual HTML or rename/redescribe tool |
| HIGH | catalog.list overflow without filters | Add summary mode or pagination |
| MEDIUM | design.compose generic slot intent | Parse per-slot intent from keywords |
| MEDIUM | repl.validate patch mode undocumented | Document patch format, improve error messages |
| MEDIUM | brand.apply preview too verbose | Return only changed tokens in structured diff |
| LOW | tokens.build empty in preview mode | Return build summary in preview |
| LOW | No trait name suggestions on empty results | Add fuzzy matching / "did you mean" |

---

## Overall Assessment

**Rating: 7/10 for agent UX**

The conceptual design is 9/10 — the governance loop, trait-based architecture, and structured output are genuinely well thought out. The implementation is about 6/10 right now due to the bugs and friction points above. The gap between concept and execution is addressable, and most fixes are straightforward.

The two changes that would have the biggest impact on my workflow:
1. **Pipeline tool or schema caching** (eliminates 60%+ of redundant data)
2. **Fix the React triple-brace bug** (eliminates manual post-processing)

If those two landed, I'd rate the agent UX at 8.5/10.

---

*Report generated by Claude Code (Opus 4.6) during a live testing session on 2026-03-04. All tool calls were made through the MCP stdio adapter. No mock data was used — all observations are from real tool responses.*

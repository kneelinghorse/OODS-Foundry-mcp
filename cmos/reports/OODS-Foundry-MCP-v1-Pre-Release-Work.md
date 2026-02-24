# OODS Foundry MCP — v1 Pre-Release Work Items

**Date:** 2026-02-23
**Author:** Planning session PS-2026-02-23-008
**For:** OODS Foundry team

---

## 1. Remove/Gate `design.generate` (BLOCKING)

**What:** `packages/mcp-server/src/tools/design.generate.ts` is a stub. It returns a hardcoded `Stack > Text` tree regardless of input. It's registered as an auto tool in `registry.json`.

**Why it matters:** If someone connects to the MCP and calls `design.generate`, they'll get a static placeholder and assume the tool is broken. Worse — it sets the expectation that we're competing with v0/Replit on generative UI. We're not. Our v1 story is semantic intelligence: Discover, Validate, Theme.

**Action (pick one):**

- **Option A — Remove entirely.** Delete the tool handler, its schemas (`design.generate.input.json`, `design.generate.output.json`), and its entry from `registry.json` and `toolSpecs` in `index.ts`. Clean cut.
- **Option B — Gate behind experimental flag.** Move `design.generate` from the `auto` array to `onDemand` in `registry.json`. Add a note in Tool-Specs.md that it's experimental. Only available when `MCP_EXTRA_TOOLS=design.generate` is set.

**Recommendation:** Option A. Ship what's real. Add it back when there's a real implementation behind it.

**Files to touch:**
- `packages/mcp-server/src/tools/design.generate.ts` — delete or keep gated
- `packages/mcp-server/src/tools/registry.json` — remove from `auto`
- `packages/mcp-server/src/index.ts` — remove from `toolSpecs`
- `packages/mcp-server/src/schemas/design.generate.input.json` — delete
- `packages/mcp-server/src/schemas/design.generate.output.json` — delete

---

## 2. Remove `catalog.list` from `auto` Until Schemas Are Published (NON-BLOCKING)

**What:** `catalog.list` is a real, working tool — but its input/output schemas (`catalog.list.input.json`, `catalog.list.output.json`) and types (`types.ts`) were added Feb 5. Verify these schemas match the actual runtime behavior and that the Tool-Specs.md doc covers `catalog.list`.

**Action:** Add `catalog.list` to Tool-Specs.md contract summary section. Verify schema accuracy. If schemas are solid, keep it auto. If not, move to onDemand until verified.

---

## 3. Update Tool-Specs.md for v1 (BLOCKING)

**What:** `docs/mcp/Tool-Specs.md` is at v0.2 and doesn't document `catalog.list` or `design.generate`. The contract summaries are sparse.

**Action:** Update to v1.0 with:
- Full contract summaries for all auto tools
- Input/output examples for `repl.validate`, `repl.render`, `catalog.list`, `brand.apply`, `structuredData.fetch`
- Remove or note `design.generate` per decision above
- Document the UiSchema DSL (reference `repl.ui.schema.json`)

---

## 4. Public README Rewrite (BLOCKING)

**What:** Current README is agent-oriented ("What agents can do here"). For public release, needs to explain the value proposition to humans who will decide whether to install it.

**Action:** Rewrite opening sections to frame the 3 capability pillars:
- **Discover** — query the semantic component registry (73 components, 35 traits, 12 objects)
- **Validate** — check UI schemas against the OODS contract, catch unknown components, enforce structure
- **Theme** — apply brand token overlays, generate CSS custom properties, get before/after diffs

Keep the agent-first repo layout section. Add a "Quick demo" section with the v1 demo pipeline (see item 8).

---

## 5. Structured Data Freshness Check (NON-BLOCKING)

**What:** The latest structured data artifacts are from 2025-12-19. That's 2+ months stale.

**Action:** Run the structured data refresh pipeline before release. Update `artifacts/structured-data/manifest.json` with a current timestamp. Ensure component count, trait count, and object count are accurate for whatever the system ships as v1.

---

## 6. Verify Security Model for Public Exposure (BLOCKING)

**What:** The MCP server has real security (RBAC, rate limiting, concurrency guards, sandboxed writes). But it was built for internal use. Before public release:

**Action:**
- Review `packages/mcp-server/src/security/policy.json` — are the default role permissions appropriate for public users?
- Confirm artifact write paths can't escape the sandbox
- Ensure no hardcoded paths leak internal directory structure
- Review the `REPO_ROOT` resolution in tool handlers (several tools use `path.resolve(__dirname, '../../../../')` — this is fragile if the package structure changes)

---

## 7. Repo Strategy: Two Repos, Keep Them Separate

**Decision: Keep OODS Foundry and OODS Foundry MCP as separate repositories.**

**Rationale:**

| Factor | Separate repos | Merged repo |
|--------|---------------|-------------|
| Release cadence | Design system and agent tooling evolve independently | Coupled releases; token change forces MCP redeploy |
| Audience | DS consumers don't need MCP deps; agents don't need Storybook | Everyone gets everything |
| Open source strategy | MCP is MIT public; DS can have different licensing/timing | Must open-source everything or use monorepo path filtering |
| Sync cost | Snapshot model requires periodic refresh | Zero sync cost |
| Red Hat model | Aligns perfectly — kernel (DS) vs distribution (MCP) | Breaks the separation |

The current architecture already handles this well:
- MCP keeps a synced snapshot in `artifacts/structured-data/`
- `structuredData.fetch` serves from that snapshot
- Refresh pipeline (`docs/mcp/Structured-Data-Refresh.md`) documents the sync process

**The sync cost is real but manageable.** Item 5 above (freshness check) is the discipline needed. Consider automating the structured data refresh as a GitHub Action that runs on OODS Foundry releases and opens a PR on the MCP repo.

---

## 8. Build End-to-End Demo Pipeline (BLOCKING)

**What:** A runnable demo script that shows the MCP's complete governance loop using the existing structured data — no external dependencies, no Stage1, no Synthesis Workbench. This is the "try it in 60 seconds" artifact for the README and for conference demos.

**Scope:** The demo uses ONLY the MCP's own tools and data. It does NOT reference, expose, or depend on Stage1 or the Synthesis Workbench. Those are separate, private projects and must not be mentioned, linked, or implied in any public-facing material.

**Demo flow (4 steps):**

### Step 1 — Discover: `catalog.list`
Query the component registry. Show the agent asking "what do you have?" and getting back structured component data with traits, prop schemas, slots, and contexts.

```
Input:  { category: "core" }
Output: 73 components, filterable by trait/context/category
```

The point: the agent doesn't guess — it reads from a semantic registry.

### Step 2 — Validate: `repl.validate`
Hand it a UI schema that an agent might propose. Include one deliberately wrong component name to show validation catching it.

```json
{
  "version": "1.0.0",
  "screens": [{
    "id": "dashboard",
    "component": "Stack",
    "children": [
      { "id": "header", "component": "PageHeader", "props": { "title": "Account" } },
      { "id": "actions", "component": "FakeComponent", "props": {} }
    ]
  }]
}
```

Expected output: `status: "invalid"`, error on `FakeComponent` (UNKNOWN_COMPONENT), clean pass on everything else. Meta shows screen count, node count.

The point: the system has opinions. It tells the agent what's allowed.

### Step 3 — Render: `repl.render`
Fix the invalid component, re-submit. Show the render preview — screen IDs, routes, summary.

The point: validated schemas produce render-ready output.

### Step 4 — Theme: `brand.apply`
Apply a brand overlay to the token set. Show the before/after diff, the generated CSS custom properties, the diagnostics output.

```
Input:  { brand: "A", delta: { "color": { "primary": { "$value": "#1a73e8" } } }, apply: true }
Output: token diffs across base/dark/hc themes, variables.css, specimens.json
```

The point: theming is a governed operation with audit trails, not a find-and-replace.

**Deliverable:** A single TypeScript script at `scripts/demo/v1-pipeline.ts` that runs all 4 steps sequentially against the MCP server (stdio), prints formatted output, and exits. Should work with `pnpm exec tsx scripts/demo/v1-pipeline.ts`.

**What NOT to include:**
- No references to Stage1, inspection, crawling, or surface analysis
- No references to the Synthesis Workbench
- No "coming soon" teasers about generation capabilities
- No external URLs or live-site scanning
- The demo operates entirely against local structured data artifacts

---

## Summary

| # | Item | Priority | Effort |
|---|------|----------|--------|
| 1 | Remove/gate `design.generate` | BLOCKING | 30 min |
| 2 | Verify `catalog.list` schemas | Low | 1 hr |
| 3 | Update Tool-Specs.md to v1 | BLOCKING | 2-3 hrs |
| 4 | Public README rewrite | BLOCKING | 2 hrs |
| 5 | Structured data refresh | Low | 30 min |
| 6 | Security model review | BLOCKING | 2-3 hrs |
| 7 | Repo strategy (keep separate) | Decision | Done |
| 8 | Build v1 demo pipeline | BLOCKING | 3-4 hrs |

**Total blocking work: ~1.5 days of focused effort.**

**IP boundary (hard rule):** Stage1 and Synthesis Workbench are private, unreleased projects. No public-facing material — README, docs, demo scripts, articles, or comments — should reference, link to, or imply their existence. The MCP stands on its own: it governs a semantic design system. How the data gets into that system is a separate concern and a separate product.

The system is more ready than it feels. The code is production-grade. What's missing is the public-facing documentation, a clean removal of the one thing that isn't real yet, and a demo that shows the governance loop in action.

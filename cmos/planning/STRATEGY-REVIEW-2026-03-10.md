# Design Tools Strategy Review — March 10, 2026

## Overview

This document captures the findings from a strategic review of Stage1 Inspector, OODS Foundry MCP, and Synthesis Workbench. It includes research-backed landscape analysis, detailed bug reports, and a proposed roadmap.

---

## Part 1: Research Findings (DT-R001)

**Source**: TraceLab Deep Research — 34 sources, 5 loops, 308K tokens
**Project**: https://namozine.com/projects/1ca2ce70-e6c2-4593-aeb8-b4aa9f3fff01

### Key Signals

#### 1. Stage1 Has No Competitors
The research found **zero tools** in the structured web analysis/capture-for-agent-consumption space. Objective OBJ03 (catalog structured web analysis tools) scored 0% — not because the research was bad, but because **nothing exists**. The market is moving from screenshot-and-guess (GPT-4V, Claude Vision) toward DOM/accessibility-tree parsing (Playwright, Taxy.ai, MultiOn), but nobody packages this as a structured evidence pipeline for agent consumption the way Stage1 does.

> "No source provided quantitative benchmarks directly comparing end-to-end task success rates for agents using structured analysis versus those using purely visual inference. The competitive landscape for commercial tools that specifically package structured analysis for agent consumption is still emerging."

**Implication**: Stage1 is in a blue ocean. The question isn't competition — it's whether the market knows it needs this yet.

#### 2. OODS Foundry Is Explicitly Named as a Pioneer
The research identified OODS Foundry as **the** example of an MCP-enabled design system:

> "OODS Foundry is identified as an open-source, object-oriented design system specifically built to be usable by AI agents through a built-in Model Context Protocol (MCP) server."

No direct competitors were found. Figma and Supernova now have MCP servers, but they expose existing design data (tokens, component structure) — they don't do semantic composition, validation, or intent-driven UI generation. They're read-only bridges to existing systems. OODS Foundry is a generative engine.

| Tool | MCP Function | Comparison to OODS |
|------|-------------|-------------------|
| Figma MCP | Exposes structure, properties, tokens | Read-only. No composition, no validation, no codegen |
| Supernova MCP | Secure access to design tokens, components, docs | Read-only. Documentation-focused |
| OODS Foundry | 31 tools: compose, validate, render, codegen, map, theme | Full generative pipeline |

#### 3. Agent Environments ARE the Surface
Top tech companies (Atlassian, Shopify, Notion) now mandate Claude Code and Cursor for 100% of designers. The research confirms the shift:

> "Design is viewed as 'infrastructure, not decoration.' A greater focus on defining problems and intent prior to coding."

This validates pausing the Workbench. The "surface" designers use is Claude Code / Cursor with MCP tools — not a custom chat UI.

#### 4. The Workbench Question: Needed But Not By Us
The research found signal that a visual human-in-the-loop interface matters:

> "An effective 'workbench' is described as a necessary interface for a 'human-in-the-loop' to review, refine, and validate the work produced by AI systems."

But this need is being met by v0, Bolt, Lovable and the AI-native IDEs themselves. Building our own is competing with well-funded incumbents on their turf. Our value is in the semantic tools underneath, not the surface on top.

#### 5. 40% of Agentic AI Projects Will Fail
Enterprise adoption of agentic AI hit 35% in early 2026, but an estimated 40% of projects face cancellation by 2027. The cause: **reliability and ROI gaps**. The strategic focus has shifted to trust, evaluation, and governance layers.

**Implication**: Stage1's "contracts over vibes" philosophy and OODS Foundry's validation/governance layer are exactly what the market needs to avoid the 40% failure rate.

---

## Part 2: OODS Foundry — Potential Issues to Verify

> **IMPORTANT**: These were identified by analyzing the codebase via MCP tooling, which may be running against a stale `dist/`. The project was tested on fresh installs and declared production-ready at Sprint 81. Verify against current build before acting on any of these.

### Issue 1: React/Vue Codegen — Duplicate Props and Redeclared Variables

**What was reported**: The `code.generate` tool for React/TSX and Vue SFC allegedly produces:
- Redeclared destructured prop names (e.g., `const label = 'Tab 8';` after already destructuring `label` from props)
- Duplicate JSX props (e.g., `<Badge label="..." label={inventoryStatus} />`)
- Missing expected data bindings (`{name}`, `{price}`)

**Where to look**:
- React emitter in the codegen pipeline — check how props are destructured and then referenced
- Vue emitter — check `defineProps<Props>()` destructuring vs local variable declarations
- The composition output feeding into codegen — if composition produces duplicate slot entries, codegen will mirror them

**Likely stale dist?** If Sprint 80-81 addressed prop enrichment and DX polish, the test reports referencing these issues may predate the fix. Check:
1. Run `pnpm build` fresh and re-run the e2e script tests
2. Look at the 20/25 strict script test results from the March 6 e2e report — which 5 failed and why?
3. Compare the `dist/` timestamps against latest source

### Issue 2: Composition Semantic Ranking — Badge-Heavy Output

**What was reported**: `design.compose` with intent like "Product detail showing name, price, SKU" returns excessive `Badge` components instead of domain-appropriate fields. The ranking algorithm allegedly over-indexes on keyword matching.

**Where to look**:
- Composition intent parser — how are field hints weighted against component trait matching?
- Object auto-detection — Sprint 76 fixed over-eager attachment but it may still drift
- `meta.intelligence.lowConfidenceSlotNames` — is this surfaced prominently enough for agents to act on?

**Likely stale dist?** Sprint 79-81 focused on composition quality. This may already be improved. Test with fresh build.

### Issue 3: Mapping Docs/Schema Drift

**What was reported**: `map.create` prompt examples in docs use outdated payload formats that don't match the live schema.

**Where to look**:
- `docs/mcp/Tool-Specs.md` — compare payload examples to actual Zod schemas in tool implementations
- Test harness payloads vs README examples

### Verdict

These may all be artifacts of testing against old compiled output. **Recommended action**: Fresh build, run the full e2e suite, and check the 5 failing strict script tests. If they pass on fresh build, these are non-issues. If they persist, they're 2-3 days of focused work to fix.

---

## Part 3: Stage1 — app_profile.json Bug Report

### Symptom
`stage1_inspect_app` returns `PARSE_ERROR: Expected app_profile.json to be created, but it was missing` on all runs since approximately 2026-02-28 02:42 UTC. Prior runs (16 confirmed) succeeded.

### Error Flow

```
MCP tool call: stage1_inspect_app
  → packages/stage1-cli/src/index.ts: inspectApp()
    → builds pass list, runs pipeline via orchestrator
    → line ~448: checks for app_profile.json existence
    → FILE MISSING → throws PipelineRunError
  → packages/stage1-mcp/src/tools.ts: buildErrorResponse()
    → classifyError() at line ~152
    → detects "parse" in message → classifies as PARSE_ERROR (misclassification)
    → returns { error: true, code: "PARSE_ERROR" }
```

### Dependency Chain

```
app.profile
├── requires: style.fingerprint
│   └── requires: web.computed_styles
│       └── requires: web.crawl
└── requires: ia.outline
    └── requires: web.crawl
```

### Probable Root Cause: Sprint 22 Parallel Execution Refactor

**Commit**: `0c576c4e` — "Sprint 22: finalize pipeline optimizations" (2026-02-28 17:56)

**File**: `packages/stage1-core/src/orchestrator.ts`, `buildDependencyLevels()` method (lines ~181-229)

**The bug**: Line ~188 silently filters out dependencies not present in the current `passes` array:

```typescript
const deps = (pass.requires ?? []).filter((dep) => byId.has(dep));
```

This is dangerous because:
1. If a required dependency is missing from the run's pass list, it's silently dropped instead of failing loudly
2. The indegree calculation becomes incorrect — passes may run before their dependencies complete
3. `app.profile` depends on `style.fingerprint` and `ia.outline` — if either is filtered out, `app.profile` runs too early and finds no input artifacts

### Additional Issues

1. **Error misclassification**: The error says "PARSE_ERROR" but the actual problem is a missing artifact, not a parse failure. Should be `ARTIFACT_MISSING` or `DEPENDENCY_FAILED`.

2. **No partial artifacts returned**: When `app_profile` fails, `partial: null` is returned even though earlier passes (screenshots, DOM, computed styles) succeeded. The error response should include an inventory of what WAS created.

3. **No runId/runDir in error**: Downstream consumers (like Workbench) can't retrieve partial data because the error doesn't include the run directory path.

### Recommended Fix

1. **In `buildDependencyLevels()`**: Replace the silent filter with a validation check that throws if a declared dependency isn't in the pass registry
2. **In `classifyError()`**: Add `ARTIFACT_MISSING` error code; don't rely on string matching "parse"
3. **In error response**: Always include `runId`, `runDir`, and `partial` artifact inventory even on failure
4. **Estimated effort**: 2-4 hours

---

## Part 4: Proposed Roadmap

### Phase 1: Maintenance Sprint (This Week)
**Goal**: Both tools working end-to-end, no regressions

| Task | Tool | Effort | Impact |
|------|------|--------|--------|
| Fix app_profile.json dependency bug | Stage1 | 2-4 hours | Unblocks inspect_app entirely |
| Fix error classification + partial artifacts | Stage1 | 2-3 hours | Better DX for all consumers |
| Fresh build + verify OODS e2e suite | OODS | 2-3 hours | Confirm beta readiness or surface real issues |
| Fix codegen if confirmed on fresh build | OODS | 2-3 days | Beta blocker if real |

### Phase 2: Stage1 Development (Next 2-3 Sprints)
**Goal**: Stage1 produces richer, more actionable output

| Task | Effort | Why |
|------|--------|-----|
| ORCA extraction (Phase K) — real implementation | 16-20 hours | The big unlock: evidence → design object candidates. Currently stubbed. |
| Token confidence scores in output | 4-6 hours | Downstream consumers can rank real tokens vs noise |
| Component prop signatures | 12-16 hours | Enables accurate composition — agents know component interfaces |
| Progressive MCP streaming | Medium | UX during long runs (currently 5-min spinner) |

### Phase 3: OODS Foundry Polish (Interleaved)
**Goal**: Ship a confident public beta

| Task | Effort | Why |
|------|--------|-----|
| Composition ranking improvements | 3-5 days | Reduce badge-spam, weight business intent |
| Theme showcase (2-3 brand presets) | 1-2 days | Make theming immediately tangible |
| componentOverrides documentation | 1 day | Front-and-center escape hatch for composition quality |
| Interactive playground / REPL mode | Medium | First-run experience for new users |

### Phase 4: The Flywheel (After Phase 2-3)
**Goal**: Stage1 + OODS working together without Workbench

```
Stage1 captures site → ORCA extracts design candidates
  → OODS maps candidates to semantic objects
    → OODS composes new UI from mapped objects
      → Agent validates + renders in any MCP-capable environment
```

This is the full pipeline running in Claude Code, Cursor, or any agent environment. No custom UI needed.

### Workbench: Paused, Not Deleted

The Workbench stays as:
- Reference implementation for Stage1 + OODS integration
- Working demo for stakeholder presentations
- Test bed if we ever need a visual surface again

Active development paused. Revisit if market signal changes or if we target non-developer users.

---

## Appendix: Research Telemetry

| Metric | Value |
|--------|-------|
| Mission ID | DT-R001 |
| Research depth | Deep |
| Loops executed | 5/5 |
| Sources consulted | 34 |
| Findings recorded | 31 |
| Quality gates | Passed |
| Duration | 35 minutes |
| Total tokens | 308,729 |

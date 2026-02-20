# Sprint 41 Plan: Agent-First OODS Onboarding

**Created:** 2025-12-18
**Status:** Planning
**Focus:** Transform OODS-Foundry-mcp into an agent-first design system interface
**Theme:** "Agents are first-class citizens"

---

## Strategic Context

### Identity Shift
**We ARE NOT the design system. We USE the design system to create designs.**

OODS-Foundry-mcp is the agent interface to OODS Foundry. This repo is where:
- Agents learn how OODS works (traits, objects, contexts, tokens)
- Agents get tools to design with OODS
- UX research inputs flow in, design outputs flow out
- The "OODS brain" lives for agent consumption

### Current State (Post Upstream Sync)
- Fresh upstream sync with parent OODS Foundry (new traits, objects, data viz)
- 16 MCP tools exist (mix of audit/restriction + agent-enabling)
- Structured data last refreshed 2025-11-26 (stale)
- agents.md has restrictions that block agent autonomy
- No agent-focused runbooks exist

---

## Sprint 41 Missions

### Phase 1: Identity & Foundation

| ID | Mission | Est. Hours | Priority |
|----|---------|------------|----------|
| B41.1 | Repo Identity Update | 2-3 | P0 |
| B41.2 | Structured Data Refresh | 2-3 | P0 |
| B41.3 | Tool Inventory & Cleanup | 2-3 | P1 |

### Phase 2: Agent Charter & Runbooks

| ID | Mission | Est. Hours | Priority |
|----|---------|------------|----------|
| B41.4 | Agent Charter (agents.md rewrite) | 3-4 | P0 |
| B41.5 | Core Runbooks | 4-6 | P0 |
| B41.6 | Context Loading Strategy | 2-3 | P1 |

**Total Estimated:** 15-22 hours

---

## Mission Details

### B41.1: Repo Identity Update

**Intent:** README and package.json clearly identify this as OODS-Foundry-mcp (the agent interface), not the design system itself.

**Files to touch:**
- `README.md` - Complete rewrite
- `package.json` - Name/description update
- Remove or archive restriction-focused language from all top-level docs

**Deliverables:**
- README that says "this is where agents design with OODS"
- Clear separation: "OODS Foundry = design system" vs "OODS Foundry MCP = agent tools"
- Links to parent repo for the design system itself

**Success criteria:**
- A new agent reading README knows exactly what this repo is for
- No confusion with parent OODS Foundry repo

---

### B41.2: Structured Data Refresh

**Intent:** Refresh component/trait/object inventories after upstream sync. Account for new data viz complexity.

**Files to touch:**
- `cmos/planning/oods-components.json`
- `cmos/planning/oods-tokens.json`
- `cmos/scripts/refresh_structured_data.py` (if viz needs special handling)

**Commands to run:**
```bash
python cmos/scripts/refresh_structured_data.py --artifact-dir artifacts/structured-data --version-tag 2025-12-18
```

**Expected artifacts:**
- Updated `oods-components.json` with new traits/objects
- Delta report showing what upstream sync added
- Viz component entries with render complexity metadata

**Validation:**
- Count traits/objects before and after
- Spot-check new items (Taggable, Cancellable, Timestampable from recent commits)

---

### B41.3: Tool Inventory & Cleanup

**Intent:** Identify which MCP tools add token overhead vs. value. Disable or remove restriction-focused tools that don't serve agent workflows.

**Files to touch:**
- `packages/mcp-server/src/tools/*.ts` (audit each)
- Tool registration config (if exists)
- docs/mcp/Tool-Specs.md (update if tools removed)

**Evaluation criteria for each tool:**
| Tool | Keep? | Reason |
|------|-------|--------|
| `structuredData.fetch` | YES | Core agent capability |
| `repl.render` | YES | Design generation |
| `tokens.build` | YES | Brand/theme application |
| `brand.apply` | YES | Design system leverage |
| `purity.audit` | EVALUATE | May be overhead |
| `a11y.scan` | EVALUATE | Useful but maybe on-demand only |
| `vrt.run` | EVALUATE | CI concern, not agent workflow |
| `release.verify` | NO | Not agent workflow |

**Deliverables:**
- Decision table for all 16 tools
- Disabled/removed tools that add overhead
- Updated tool registration

---

### B41.4: Agent Charter (agents.md Rewrite)

**Intent:** Transform agents.md from "restrictions document" to "agent empowerment charter."

**Current problems:**
- "Do NOT write to cmos/"
- Compartmentalized boundaries
- Manual checklists before work
- Focus on what agents CAN'T do

**New structure:**
```markdown
# OODS Agent Charter

## What OODS Foundry Is (8-12 lines)
- Trait engine: composable capabilities
- Object registry: canonical domain objects
- View engine: context-aware rendering
- Token system: DTCG → CSS variables

## What Agents Can Do Here
- Design with OODS traits and objects
- Generate UI from research context
- Apply brand/theme transformations
- Build new traits, objects, charts
- Update structured data inventories
- [Full capability list]

## Available Tools
- [Tool inventory with usage patterns]

## How to Get Started
- [Quick path to first design action]

## Agent Suggestion Box
- [How to propose improvements to agent UX]
```

**Files to touch:**
- `agents.md` - Complete rewrite
- `cmos/agents.md` - Merge into root or deprecate

**Success criteria:**
- An agent reading agents.md knows what they CAN do, not what they can't
- Clear tool inventory with usage patterns
- Suggestion mechanism for agent UX improvements

---

### B41.5: Core Runbooks

**Intent:** Create task-driven runbooks that give agents fast paths for common work.

**Runbooks to create (in `docs/runbooks/`):**

#### 1. `add-a-trait.md`
- Intent: Create a new trait definition
- Files: `src/traits/`, `src/core/trait-definition.ts`, tests
- Commands: validation, test run, structured data refresh
- Expected artifacts: trait file, test file, updated registry
- Failure modes: naming collision, invalid schema, missing tests

#### 2. `add-an-object.md`
- Intent: Compose traits into a new domain object
- Files: `src/objects/`, compositor config
- Commands: composition validation, conflict resolution
- Expected artifacts: object definition, generated types
- Failure modes: trait conflicts, missing dependencies

#### 3. `add-a-chart.md`
- Intent: Add a new visualization pattern
- Files: viz traits, renderer bindings, stories
- Commands: render test, a11y check
- Expected artifacts: chart component, story, test
- Failure modes: data binding errors, a11y violations

#### 4. `change-tokens-safely.md`
- Intent: Modify design tokens with governance
- Files: `packages/tokens/`, build config
- Commands: `pnpm tokens:build`, diff generation
- Expected artifacts: updated CSS vars, delta report
- Failure modes: breaking changes, missing fallbacks

#### 5. `update-status-map.md`
- Intent: Add/modify status mappings (billing states, etc.)
- Files: status maps, StatusChip, fixtures, tests
- Commands: fixture generation, test run
- Expected artifacts: updated maps, passing tests
- Failure modes: unmapped states, test failures

**Runbook template (each follows same shape):**
```markdown
# [Task Name]

## Intent
What "done" means in one sentence.

## Files You Will Touch
- [file list with purpose]

## Commands to Run
```bash
# step-by-step commands
```

## Expected Artifacts
- [what gets created/modified]

## Common Failure Modes
| Symptom | Cause | Fix |
|---------|-------|-----|
```

---

### B41.6: Context Loading Strategy

**Intent:** Define how agents should load context efficiently without consuming entire repo.

**The "secret" for big repo onboarding:**
1. **Always load:** Agent Charter (agents.md) - small, stable
2. **Load one:** Relevant runbook for current task
3. **Load 2-4:** Deep docs most relevant to task
4. **Then:** Let retrieval pull specifics

**Files to create:**
- `docs/agent-operations/context-loading.md` - Strategy guide
- Context manifests for common tasks (which docs to load when)

**Deliverables:**
- Context loading guide
- Task → docs mapping table
- Recommended context budget (token estimates)

---

## Dependencies & Sequencing

```
B41.1 (Identity) ─┬─→ B41.4 (Charter)
                  │
B41.2 (Data) ─────┼─→ B41.5 (Runbooks)
                  │
B41.3 (Tools) ────┴─→ B41.6 (Context Strategy)
```

- B41.1 and B41.2 can run in parallel (foundation work)
- B41.3 should inform B41.4 (tool list in charter)
- B41.4 and B41.5 are the core deliverables
- B41.6 ties it together

---

## Success Criteria for Sprint 41

1. **Identity clear** - README/package.json distinguish this from parent repo
2. **Data fresh** - Structured data reflects upstream sync (new traits/objects/viz)
3. **Tools focused** - Overhead tools disabled, agent-enabling tools documented
4. **Charter empowers** - agents.md lists capabilities, not restrictions
5. **Runbooks exist** - 5 core runbooks in consistent format
6. **Context strategy defined** - Agents know how to load context efficiently

---

## What Gets Deferred

- Full tool enhancement (beyond cleanup) → Sprint 42
- Design Lab Shell integration → Sprint 42
- Vector DB for research context → Future (validate flat files first)
- Agent suggestion box implementation → Sprint 42

---

## Open Questions

### Q1: Merge or separate agents.md files?
**Option A:** Merge cmos/agents.md into root agents.md
**Option B:** Keep separate but cross-reference
**Recommendation:** Option A (single source of truth)

### Q2: What to do with purity.audit and a11y.scan tools?
**Option A:** Remove entirely (save tokens)
**Option B:** Keep but make on-demand only (not auto-registered)
**Option C:** Keep as-is (value for quality)
**Recommendation:** Option B (on-demand, not default)

### Q3: How detailed should runbooks be?
**Option A:** Minimal (steps only, ~50 lines each)
**Option B:** Comprehensive (include examples, ~150 lines each)
**Recommendation:** Option A for MVP, expand based on agent feedback

---

*Planning session: PS-2025-12-18-001*
*Sprint focus: Agent-first OODS onboarding*

# CMOS MCP Feedback: Structural Fixes & Tool Proposals

**Date:** 2026-02-26
**Author:** Sprint 46 Review (OODS Foundry project)
**Context:** After 46 sprints and 209 missions using CMOS MCP, two recurring operational failures have been identified. Both are structural gaps in the MCP toolset — not process discipline issues. This report details the problems, proposes concrete tool additions, and includes additional feedback from sustained production use.

---

## 1. CRITICAL: Context Write/Condense Tool

### Problem

There is no MCP tool to write, edit, or condense context (`master_context` or `project_context`). The available tools are:

- `cmos_context_view` — read-only
- `cmos_context_snapshot` — creates a snapshot (read-only copy)
- `cmos_context_history` — lists snapshots (read-only)

When context grows beyond comfortable limits (our master_context hit 93.1% of the 100KB limit), there is **no way to condense it through the MCP toolset**. The only option is direct SQLite access, which:

- Bypasses any validation the MCP layer provides
- Requires knowledge of the database schema
- Is error-prone (raw JSON string replacement in a TEXT column)
- Cannot be done by agents without explicit human authorization for DB access
- Blocked our s46-m09 mission for an entire sprint

### What Actually Happened

Our master_context grew from ~40KB (Sprint 41) to 96.4KB (Sprint 46) over 5 sprints. Each session completion, mission completion, and review aggregates content into context — but nothing ever removes or condenses stale entries. The growth is monotonic.

Key bloat sources:
- `completed_missions`: 34 individual entries with full objectives, success criteria, deliverables (38.6 KB)
- `decisions_made`: 80 entries accumulated across all sprints (16.2 KB)
- `learnings`: 36 entries with significant duplication (12.5 KB)
- `recent_sessions`: 10 entries with full summaries (8.7 KB)
- `working_memory.session_history`: Entries from Sprint 30 still present (12.2 KB in project_context)
- `working_memory.domains`: Full mission-level detail for sprints 1-8 (18.8 KB in project_context)

After manual condensation via direct SQLite:
- master_context: 96.4 KB → 14.9 KB (84% reduction)
- project_context: 48.4 KB → 5.4 KB (89% reduction)

### Proposed Tools

#### `cmos_context_condense`

Automatic condensation that preserves semantic value while reducing size.

```
cmos_context_condense({
  contextType: "master_context" | "project_context",
  targetSizePercent: 60,          // Target percentage of limit
  strategy: "auto" | "aggressive" | "conservative",
  dryRun: true                    // Preview what would be removed/condensed
})
```

Strategy behaviors:
- **conservative**: Only removes entries older than `retention_keep_sprints`, trims session summaries to 200 chars
- **auto** (default): Conservative + deduplicates learnings/decisions + collapses per-mission entries into sprint-level summaries
- **aggressive**: Auto + removes all completed sprint detail, keeps only sprint_completions summaries

Response should include:
- Before/after sizes
- List of sections condensed with byte counts
- What was removed vs. summarized
- A snapshot ID (auto-created before any destructive operation)

#### `cmos_context_update`

Direct section-level write for targeted edits.

```
cmos_context_update({
  contextType: "master_context",
  section: "roadmap",            // Top-level key to replace
  content: { ... },             // New value for that section
  merge: false                  // true = deep merge, false = replace
})
```

This is the surgical tool — update one section without touching others. Essential for:
- Updating stale roadmap entries
- Clearing obsolete next_session_context
- Resetting working_memory after sprint transitions

---

## 2. CRITICAL: Decision Capture Enforcement

### Problem

Across sprints 42-46 (5 consecutive sprints, 34 missions), **zero decisions were captured inline during mission work**. Every sprint review flagged this gap. Every review session committed to enforcing discipline next sprint. Every next sprint failed identically.

This is not a discipline problem — it's a tooling gap. The current flow is:

1. Agent receives mission spec
2. Agent executes mission (code changes, tests, etc.)
3. Agent marks mission complete via `cmos_mission_complete`
4. No checkpoint verifies that decisions were captured

Decisions ARE being made during missions (architectural choices, technology selections, API design trade-offs) but they exist only in the conversation context and are lost when the session ends.

### Proposed: Decision Gate on Mission Completion

#### Option A: Soft gate (recommended for v1)

Add a `decisions` parameter to `cmos_mission_complete`:

```
cmos_mission_complete({
  missionId: "s47-m03",
  notes: "...",
  decisions: [                    // Optional but tracked
    "Chose X over Y because Z"
  ]
})
```

When `decisions` is empty/omitted, the response includes a warning:

```json
{
  "success": true,
  "warnings": [
    "No decisions captured for this mission. Consider documenting architectural choices made during implementation."
  ],
  "decisionCount": 0,
  "sprintDecisionCount": 0
}
```

The `sprintDecisionCount` field shows the running total for the sprint — making the zero-decision pattern visible at every mission boundary.

#### Option B: Hard gate (optional strict mode)

A sprint-level or project-level setting:

```
cmos_sprint_update({
  sprintId: "sprint-47",
  fields: {
    requireDecisions: true,       // Missions cannot complete without >= 1 decision
    minDecisionsPerMission: 1
  }
})
```

When enabled, `cmos_mission_complete` returns an error if no decisions exist for that mission:

```json
{
  "success": false,
  "error": "DECISION_GATE",
  "message": "Sprint requires at least 1 decision per mission. Use cmos_session_capture(category='decision') before completing.",
  "currentDecisions": 0,
  "required": 1
}
```

#### Option C: Decision prompt in onboarding

`cmos_agent_onboard` already returns `suggestedActions`. Add a persistent reminder when the current sprint has a low decision-to-mission ratio:

```json
{
  "suggestedActions": [
    {
      "action": "Decision capture gap: 0 decisions in 3 completed missions this sprint",
      "command": "cmos_session_capture(category='decision', content='...')",
      "priority": 1
    }
  ]
}
```

### Recommendation

Ship Option A (soft gate) immediately — it's backward compatible and makes the problem visible. Add Option C to onboarding for awareness. Defer Option B until teams have had time to adopt the soft gate pattern.

---

## 3. Additional Feedback from Production Use

### 3.1 Context Growth is Monotonic — No Automatic Pruning

Every `cmos_session_complete` and `cmos_mission_complete` aggregates content into context, but nothing ever prunes. Over 46 sprints:

- Session summaries accumulate indefinitely in `recent_sessions`
- Completed mission specs accumulate in `completed_missions` with full detail
- Learnings and decisions are append-only with no deduplication
- Stale `next_steps` from 10+ sessions ago remain in the list

**Suggestion:** Add configurable retention policies that execute automatically during session/sprint completion:

```yaml
context_retention:
  recent_sessions: 5              # Keep last N sessions
  completed_missions: "sprint"    # Summarize to sprint-level after retention window
  next_steps: "session"           # Clear stale next_steps on session start
  learnings_dedup: true           # Merge semantically similar learnings
```

### 3.2 Sprint Status Transition Has No Side Effects

When a sprint is marked `Completed` via `cmos_sprint_update`, nothing happens automatically. Our project repeatedly forgot to:

1. Take a context snapshot
2. Archive old sprint detail from context
3. Update the roadmap section

**Suggestion:** Add lifecycle hooks to sprint transitions:

```
cmos_sprint_update(sprintId, { status: "Completed" })
→ Auto-triggers:
  1. Context snapshot (both master + project)
  2. Archive completed sprint detail from context (move to snapshots)
  3. Update roadmap section with sprint summary
```

This would eliminate an entire class of "forgot to close out" errors.

### 3.3 `cmos_agent_onboard` Returns Stale `nextSteps`

The `nextSteps` array in onboarding accumulates from every session's `nextSteps` parameter but is never cleared. After 20+ sessions, we had 10+ stale next steps referencing completed work (e.g., "Start s46-m01" when s46-m01 was already done).

**Suggestion:** `cmos_agent_onboard` should:
- Only return `nextSteps` from the most recent session (not all sessions)
- Or automatically clear `nextSteps` that reference completed missions
- Or add a `cmos_context_prune_nextsteps` tool

### 3.4 No Way to View Context Size Without Full Content

To check if context is approaching the limit, you must call `cmos_context_view` which returns the entire content. For a 96 KB context, this consumes significant context window space just to check a number.

**Suggestion:** Add size-only mode:

```
cmos_context_view({
  contextType: "master_context",
  sizeOnly: true
})
→ { sizeBytes: 96962, sizeKb: 94.7, limitKb: 100, usagePercent: 94.7 }
```

(Note: `cmos_agent_onboard` does return `contextSizes`, which partially addresses this. But a dedicated lightweight check would be useful for monitoring during long sessions.)

### 3.5 Session Capture Categories Are Limited

The current categories (`decision`, `learning`, `constraint`, `context`, `next-step`) cover most needs, but we've wanted:

- **`blocker`** — to capture blocking issues encountered during missions (currently forced into `constraint` or `context`)
- **`trade-off`** — explicitly documenting what was considered but rejected and why (currently mixed into `decision`)

These additional categories would improve the signal quality of context aggregation.

### 3.6 No Mission-Level Decision Association

`cmos_session_capture(category='decision')` captures decisions at the session level. There's no way to associate a decision with a specific mission ID. When reviewing sprint decisions later, you can't tell which mission produced which decision.

**Suggestion:** Add optional `missionId` parameter to `cmos_session_capture`:

```
cmos_session_capture({
  category: "decision",
  content: "Chose static HTML over React SSR",
  missionId: "s44-m02"           // Optional association
})
```

This would make retroactive decision auditing much easier — you could query "what decisions were made during mission X?"

---

## Summary of Proposals

| # | Tool/Feature | Priority | Effort | Impact |
|---|---|---|---|---|
| 1 | `cmos_context_condense` | CRITICAL | Medium | Prevents context bloat from blocking operations |
| 2 | `cmos_context_update` | CRITICAL | Low | Enables targeted context edits without full replacement |
| 3 | Decision gate on `cmos_mission_complete` | HIGH | Low | Breaks the 5-sprint zero-decision pattern |
| 4 | Automatic retention policies | HIGH | Medium | Prevents monotonic context growth |
| 5 | Sprint completion lifecycle hooks | MEDIUM | Medium | Eliminates close-out process failures |
| 6 | Stale nextSteps pruning | MEDIUM | Low | Improves onboarding signal quality |
| 7 | Context size-only view | LOW | Trivial | Convenience for monitoring |
| 8 | Additional capture categories | LOW | Trivial | Better signal taxonomy |
| 9 | Mission-level decision association | LOW | Low | Enables decision-to-mission traceability |

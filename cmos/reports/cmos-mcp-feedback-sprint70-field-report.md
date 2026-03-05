# CMOS MCP Field Report: 70 Sprints In Production

**Date:** 2026-03-05
**Author:** Sprint 70 Review (OODS Foundry project)
**Context:** After 70 sprints, 400+ missions, and 60+ sessions using CMOS MCP, this report covers bugs discovered, features that landed well, and proposals for the next wave of improvements. This follows up on the Sprint 46 structural feedback report — many of those proposals shipped and are evaluated here.

---

## 1. Shipped Proposals — Status Check

The Sprint 46 report proposed 9 items. Here's how they landed:

| # | Proposal | Status | Notes |
|---|---|---|---|
| 1 | `cmos_context_condense` | Shipped (partial) | `conservative` strategy works. `auto` and `aggressive` strategies error (see Section 2). |
| 2 | `cmos_context_update` | Shipped | Works well for targeted section edits. |
| 3 | Decision gate on `cmos_mission_complete` | Shipped | `decisions` param + `sprintDecisionCount` in response. Soft gate working. |
| 4 | Automatic retention policies | Not shipped | Context growth is still monotonic. Conservative condensation is manual-only. |
| 5 | Sprint completion lifecycle hooks | Not shipped | Still no auto-snapshot or context archival on sprint completion. |
| 6 | Stale nextSteps pruning | Partial | `cmos_agent_onboard` still accumulates stale next steps from old sessions. |
| 7 | Context size-only view | Shipped | `cmos_context_view({ sizeOnly: true })` works perfectly. Lightweight monitoring. |
| 8 | Additional capture categories (`blocker`, `trade-off`) | Not shipped | Still using `constraint` and `decision` as proxies. |
| 9 | Mission-level decision association | Shipped | `missionId` param on `cmos_session_capture` works. |

**Score: 5/9 shipped, 1 partial, 3 outstanding.** Good progress. The outstanding items (4, 5, 8) are still pain points.

---

## 2. BUG: `cmos_context_condense` — `auto` and `aggressive` Strategies Fail

### Reproduction

```
cmos_context_condense({
  contextType: "master_context",
  strategy: "auto",    // or "aggressive"
  dryRun: true
})
```

**Result:** `MCP error -32603: Tool execution failed`

This happens consistently — tested multiple times in the Sprint 70 review session. The `conservative` strategy works fine (trimmed session summaries, removed 44 old sprint entries, reduced master_context from 80.2KB to 71.0KB). But `auto` and `aggressive` always error with no useful diagnostic.

### Impact

- Conservative alone reduced context by 11.5% (80.2KB to 71.0KB)
- We likely need auto/aggressive to hit targets below 60% — conservative maxes out after one pass with nothing left to trim
- Without working auto strategy, deduplication of learnings/decisions and sprint-level collapse don't happen
- Manual SQLite editing remains the fallback for deep condensation, which defeats the purpose of the tool

### Suggestion

- Return the underlying error message instead of generic -32603
- Add error logging/tracing so the failure point within auto/aggressive logic is identifiable
- Consider adding a `verbose` or `debug` flag to condensation that returns the intermediate steps

---

## 3. BUG: Sprint Status Never Transitions from "Planned" to "Active"

Sprint 70 shows `status: "Planned"` in `cmos_sprint_show` even though all 6 missions were completed. Similarly, `cmos_agent_onboard` reported `currentSprint: sprint-64` (the last sprint marked Active) rather than sprint-70.

### Root Cause

Starting a mission with `cmos_mission_start` doesn't automatically transition the parent sprint to "Active". And `cmos_sprint_update` to set status="Active" isn't part of the standard workflow — agents forget, and there's no enforcement.

### Suggestion

- `cmos_mission_start` should auto-transition the parent sprint to "Active" if it's currently "Planned"
- `cmos_mission_complete` on the last mission in a sprint should auto-transition to "Completed"
- Or at minimum, `cmos_agent_onboard` should detect the most recent sprint with activity (missions started/completed) rather than relying on the status field

---

## 4. FEATURE REQUEST: Context Growth Alerts in Session Flow

### Problem

Context grew from ~40KB to 80KB over Sprints 47-70 without any in-flow warning. The only way to notice is checking `cmos_agent_onboard` warnings or `cmos_context_view({ sizeOnly: true })` — both require the agent to actively look.

### Suggestion

Add context size warnings to high-frequency touchpoints:

- **`cmos_session_complete`** response: Include `contextSizes` in the response (it already aggregates content — surfacing size is trivial)
- **`cmos_mission_complete`** response: Same — include current context usage percentage
- **Threshold-based nudges**: When context crosses 70%, include a `suggestedAction` for condensation in the response of any context-mutating tool

This makes growth visible without requiring agents to poll.

---

## 5. FEATURE REQUEST: Sprint Completion Lifecycle (Re-raised)

This was item #5 in the Sprint 46 report and remains the highest-value unshipped feature.

### Current Pain

Every sprint completion requires the agent to manually:

1. Update sprint status to "Completed"
2. Take a master_context snapshot
3. Take a project_context snapshot
4. Run condensation if needed
5. Clear stale next_steps

This is 5 tool calls that are identical every time. Over 70 sprints, we've forgotten at least one step roughly 40% of the time.

### Proposed: `cmos_sprint_complete`

A single tool that orchestrates the full close-out:

```
cmos_sprint_complete({
  sprintId: "sprint-70",
  summary: "SDK + Docs + API Versioning delivered",
  condensation: "auto"    // "none" | "conservative" | "auto"
})
```

Behavior:
1. Verify all missions are completed (or explicitly skipped/blocked)
2. Set sprint status to "Completed" with endDate
3. Snapshot both contexts
4. Run condensation at specified strategy
5. Clear next_steps referencing completed missions
6. Return a summary receipt with before/after sizes

This replaces 5 manual tool calls with 1 and eliminates the class of "forgot to close out" errors entirely.

---

## 6. FEATURE REQUEST: `cmos_agent_onboard` Stale Data (Re-raised)

### nextSteps Accumulation

`nextSteps` in onboarding currently returns items from many sessions back. In our Sprint 70 review, onboarding showed next steps like "Plan Sprint 70" even though Sprint 70 was already complete.

### currentSprint Detection

As noted in Section 3, `currentSprint` relies on the status field rather than actual activity. An agent onboarding fresh has no way to know which sprint is actually current without cross-referencing git branches or commit messages.

### Suggestion

- `nextSteps`: Only return items from the most recent 2 sessions, OR filter out items that reference completed missions/sprints
- `currentSprint`: Use a heuristic — the sprint with the most recent mission activity (start or complete) should be treated as current, regardless of status field

---

## 7. FEATURE REQUEST: Condensation Targeting

### Problem

`cmos_context_condense` takes a `targetSizePercent` parameter, but conservative strategy ignores it — it applies fixed rules (trim summaries, remove old sprints) regardless of target. After one conservative pass, a second pass finds nothing to do even if we're above target.

### Suggestion

Make conservative strategy iterative toward the target:
1. First pass: trim sessions to 200 chars, remove entries from old sprints
2. If still above target: further trim remaining session summaries to 100 chars
3. If still above target: collapse sprint-level entries to single-line summaries
4. If still above target: deduplicate decisions with similar content

Each step should stop as soon as the target is reached. The current behavior is "apply all conservative rules once and stop" which leaves no knobs to turn.

---

## 8. IMPROVEMENT: Decision Domain Inference

### Problem

`cmos_decisions_list({ sprintId: "sprint-70" })` returned 0 decisions even though decisions were captured during the review session. This is because session captures with `category: "decision"` don't always propagate to the `strategic_decisions` table — they only land in the session captures.

### Suggestion

- Ensure all `category: "decision"` captures create corresponding `strategic_decisions` entries
- Or add a `source: "session_capture"` field to strategic_decisions so they're queryable both ways
- `cmos_decisions_list` should optionally include session-captured decisions: `cmos_decisions_list({ includeSessionCaptures: true })`

---

## 9. QUALITY OF LIFE: Small Improvements

### 9.1 `cmos_sprint_show` — Include Decision Count from Sessions

The `decisionsCount` field only counts `strategic_decisions` table entries. Session-captured decisions are invisible. Show both counts:

```json
{
  "decisionsCount": 0,
  "sessionDecisionsCount": 3,
  "totalDecisionsCount": 3
}
```

### 9.2 `cmos_mission_list` — Filter by Sprint

Currently requires `sprintId` on `cmos_sprint_show` to see sprint missions. A `cmos_mission_list({ sprintId: "sprint-70" })` filter would be more ergonomic for agents that need just the mission list without full sprint metadata.

### 9.3 Condensation Dry Run Diff

When `dryRun: true`, show what specific content would be removed/summarized, not just byte counts. Even a truncated preview (first 80 chars of each removed entry) would help agents assess whether condensation is safe.

### 9.4 Error Messages

Generic `-32603` errors with no detail are the single biggest debugging obstacle. Every tool that can fail should return structured error info:

```json
{
  "success": false,
  "error": "CONDENSATION_FAILED",
  "message": "Auto strategy failed during deduplication phase",
  "details": "Cannot parse learnings section: unexpected null at key 'sprint_completions[12].missions'",
  "phase": "deduplication"
}
```

---

## Summary of Proposals

| # | Item | Type | Priority | Effort |
|---|---|---|---|---|
| 2 | Fix `auto`/`aggressive` condensation strategies | Bug | CRITICAL | Medium |
| 3 | Sprint status auto-transition on mission start/complete | Bug | HIGH | Low |
| 4 | Context size in session/mission complete responses | Feature | HIGH | Trivial |
| 5 | `cmos_sprint_complete` lifecycle tool | Feature | HIGH | Medium |
| 6 | Fix stale nextSteps and currentSprint in onboarding | Bug | MEDIUM | Low |
| 7 | Iterative condensation toward target | Feature | MEDIUM | Medium |
| 8 | Decision capture propagation to strategic_decisions | Bug | MEDIUM | Low |
| 9.1 | Session decision counts in sprint_show | Feature | LOW | Trivial |
| 9.2 | Sprint filter on mission_list | Feature | LOW | Trivial |
| 9.3 | Condensation dry run content preview | Feature | LOW | Low |
| 9.4 | Structured error messages (replace -32603) | Feature | HIGH | Medium |

---

## What's Working Well

To be clear: CMOS MCP has been instrumental across 70 sprints. The things that work well:

- **`cmos_agent_onboard`** — cold-start onboarding is excellent. Agents get project state in <4KB. The `contextSizes` and `warnings` additions from the Sprint 46 feedback have been valuable.
- **Session flow** (`start` → `capture` → `complete`) — the capture taxonomy (decision, learning, constraint, context, next-step) covers 90%+ of needs. Session-to-context aggregation works reliably.
- **Mission lifecycle** (`add` → `start` → `complete`) — clean and predictable. The `decisions` soft gate was a good addition.
- **`cmos_context_view({ sizeOnly: true })`** — exactly what was needed for monitoring. Lightweight, fast, useful.
- **`cmos_context_snapshot`** — reliable safety net before destructive operations. Deduplication (same content hash → no new snapshot) is smart.
- **Sprint/mission data model** — the hierarchical sprint → mission structure with status tracking, dependencies, and blocking has scaled well to 400+ missions.
- **`cmos_context_condense` (conservative)** — when it works, it works well. The before/after reporting and auto-snapshot are exactly right. Just needs the other strategies fixed.

CMOS has been the backbone of sustained, multi-session project execution. These proposals are refinements to an already-solid system.

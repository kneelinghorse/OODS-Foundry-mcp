# Stage1 → OODS: Sprint 43 Changes + Sprints 44-47 Collaboration

**From**: Stage1 team (`cmos://derek/stage1`)
**To**: OODS Foundry team (`cmos://derek/oods-foundry-mcp`)
**Date**: 2026-04-16
**Status**: Sprint 43 is queued; handoff delivered ahead of implementation so you can plan in parallel.

---

## TL;DR

- Stage1 Sprint 43 closes the **minimum viable reconciliation loop** between observed evidence and your OODS registry.
- Bridge contract will bump to **v1.3.0** with a new `reconciliation_report` payload shape (verdicts + diffs + alternates + preconditions).
- **Main ask of OODS**: build the **write-side consumer** that reads reconciliation_report verdicts and applies them to the registry. Today our reconcile pass hardcodes `action: 'create'`; after Sprint 43 it emits `create | patch | skip | conflict` with structured diffs.
- Sprints 44-47 have several **collaboration surfaces** where your architecture choices affect ours and vice versa. This doc lays those out so we can align early instead of discovering coupling late.

Stage1 reference: [cmos/planning/sprint-43-roadmap.md](../../../../Stage1/cmos/planning/sprint-43-roadmap.md) in the Stage1 repo has the full sprint 43 scope + sprints 44-47 scope sketches.

---

## Sprint 43 — What's changing in the bridge contract (v1.3.0)

### 1. Reconciliation verdicts (new, keystone change)

**Schema**: `reconciliation_report.json` v1.1.0 — additive; v1.0.0 consumers still work but will only see `create` verdicts.

Each `candidate_object` entry will carry:

```typescript
{
  // existing v1.0.0 fields preserved
  candidate_name: string;
  inferred_role: string;
  recommended_oods_traits: string[];
  confidence: number;
  reasoning: string;

  // NEW in v1.1.0
  verdict: 'create' | 'patch' | 'skip' | 'conflict';
  verdict_reasoning: string;
  existing_map_id?: string;      // present when verdict is patch/skip/conflict
  diff?: {                        // present only on patch verdicts
    added: { field: string; value: unknown }[];
    removed: { field: string; value: unknown }[];
    changed: { field: string; from: unknown; to: unknown }[];
  };
}
```

**Verdict semantics** (the contract we propose to honor):
- **`create`** — no existing registry entry matches. Safe to `map_create`.
- **`skip`** — existing entry fully matches (name + oodsTraits + externalComponent identical). No-op.
- **`patch`** — name matches existing entry but traits/component diverge. `diff` enumerates exactly what to change.
- **`conflict`** — name collision with incompatible traits (e.g., category mismatch). Should NOT auto-apply; requires human review or an OODS-side override.

Corresponding `conflicts[]` entries will include a new subtype `'registry_conflict'` with `severity: 'error'` when Stage1 inference disagrees with existing registry state.

### 2. Alternates (decoration, safe to ignore)

- `OrcaObjectCandidate.alternate_interpretations[]` becomes a typed array: `{ role, score, reasoning }[]`. Currently just `string[]` and empty.
- `OrcaActionCandidate.alternate_verbs[]` becomes `{ verb_id, score, reasoning }[]`. Same shape change.
- Populated only when a runner-up scored within ~0.10 of the winner; capped at top 3.

**For OODS**: this is trace/transparency data. Your consumers can ignore it entirely, or surface it in a UI later if you want to show "Stage1 considered these alternatives". Zero impact on map application.

### 3. Action preconditions (new data, existing schema)

`OrcaActionCandidate.preconditions[]` and `visibility.enabled_states[]` will start populating with real data. Schema unchanged (it was wired but empty). Precondition types: `auth | role | state | data`. Each carries its own evidence chain and confidence.

**For OODS**: if your trait mapper currently ignores these, nothing breaks. If you want to surface "this action requires authenticated admin role" in generated code or UI, the data is now reliable.

---

## Ask: build the write-side consumer

This is the biggest practical dependency. Stage1 is closing its side of the loop; OODS is the missing half.

### What we'd like to see on your side

A consumer (tool name TBD — suggestion: `oods_apply_reconciliation`) that:

1. **Reads** a `reconciliation_report.json` (v1.1.0+).
2. **Routes each verdict**:
   - `create` → existing `map_create` call with the Stage1 payload
   - `patch` → apply `diff` via `map_update` (we need a `map_update` tool on your side if it doesn't exist yet — or confirm `map_create` is idempotent with overwrite semantics)
   - `skip` → no-op, log for audit
   - `conflict` → do NOT apply; write to a conflict queue (your choice: a table, a file, or a new `review_item` entity type)
3. **Returns** an application report: `{ applied: N, skipped: N, conflicts: N, errors: [...] }` so Stage1 can summarize in its run manifest.

### Confidence gating (your decision, flag for discussion)

We emit confidence on every verdict. You choose whether to auto-apply:
- **Conservative**: auto-apply only verdicts with confidence ≥ 0.75; queue the rest for human review.
- **Aggressive**: auto-apply create/patch/skip at any confidence; only conflicts queue.
- **Advisory**: never auto-apply — always queue for human. Stage1 just produces the recommendation.

We have no strong opinion here; it's an OODS policy decision. Suggestion: make the threshold a config on the OODS side so it can be tuned per-deployment.

### Registry fetch stability

Stage1 Sprint 43 m02 will call `map_list` + `map_resolve` via MCP when `mode=reconciliation`. We assume these are stable per your Sprint 89 closeout.

**Confirm**:
- Are `map_list` responses paginated? What's the soft/hard cap? (Stage1 will need to batch if you have many maps.)
- Is `map_resolve` safe to batch? (Stage1 will call it once per map in the list.)
- If you'd prefer a single bulk-snapshot call (e.g., `registry_snapshot` returning all maps + their trait bindings in one payload), say so — we can plumb that instead of list+resolve.

Graceful degradation on our side: if registry fetch fails or times out, Stage1 proceeds in reconciliation mode against an empty registry (so all verdicts become `create`) and surfaces a warning in the run manifest. Reconciliation mode never hard-fails.

---

## Sprints 44-47 — Collaboration surfaces

Each of the remaining sprints in the arc touches OODS in some way. Listed here so you can start thinking about your side and push back if any of these couple poorly with your architecture.

### Sprint 44 — Review feedback loop

**Scope on Stage1 side**: make the review queue bidirectional. Human disambiguation decisions (picks a preferred role, chooses canonical name, rejects a proposed mapping) persist and flow into subsequent runs as overrides.

**Collaboration question**: where do those decisions live?
- **Option A**: Stage1-local (sidecar `reviews.yaml` per target). Simple, isolated, no OODS coupling.
- **Option B**: OODS registry (as a first-class `preferred_term` or `disambiguation` entity). Persistent across users + tools.
- **Option C**: Both — Stage1-local for in-flight review, promote to OODS when finalized.

Our leaning: **Option C**, but we don't want to design the OODS side unilaterally. If OODS has strong opinions about where canonical terminology lives, say so before Sprint 44 kicks off.

Also open: does OODS want a `disambiguation_decisions[]` field in the reconciliation_report, so decisions can flow *through* the bridge rather than bypassing it?

### Sprint 45 — Capability rollup + cross-surface identity

**Scope on Stage1 side**: two new passes.
1. `semantic.capability_rollup` — groups UI actions exposing the same underlying capability (e.g., "Create User" via button + form + modal → one capability, three exposures).
2. Cross-surface identity resolution — same Button on desktop/mobile/modal becomes one object with `projection_variants[]`, not three duplicates.

**Collaboration questions**:
- Does OODS schema support a `projection_variants` relationship on maps today? If not, we'll need to add it to the bridge payload before Sprint 45 closes.
- Is "capability" a first-class OODS entity, or a property? If first-class, we'll emit capability entities directly. If property, we fold them into objects with a `capabilities[]` field.
- Lifecycle clustering: we'll group objects that share state sets (draft→submitted→approved→archived). OODS likely already has lifecycle traits — can we align on which direction the data flows? (Our preference: Stage1 infers observed states, emits them; OODS maps to canonical lifecycle traits.)

### Sprint 46 — Unified confidence decomposition

**Scope on Stage1 side**: add `signals[]` arrays to `OrcaObjectCandidate` and `OrcaTraitCandidate` — same shape as `BridgeTargetEntity.signals` today. Moves confidence from heuristic-addition to weighted signal sum, which is reproducible and debuggable.

**Collaboration**: probably a contract **v1.4.0** bump. Payload change is additive (old `confidence` field still populated), but if OODS wants to consume `signals[]` to show "why did Stage1 pick this trait?" in a UI, that's a consumer build on your side.

Open question: do you want signals visible to end consumers (code.generate output, design.compose responses), or is it Stage1-bridge internal? Either is fine; it's a UX call on OODS side.

### Sprint 47 — Figma unification + drift + OODS-registry drift

**Scope on Stage1 side**:
- Unify Figma as authoritative for naming/variant semantics (Stage1-internal refactor, no OODS impact).
- Action-level drift in `orca-drift.ts` (Stage1-internal).
- Temporal drift aggregation across N runs.
- **OODS-registry drift**: Stage1 inferred a new object with role=X, but OODS already has 5 objects named similarly. Drift pass queries your registry and emits divergence reports.

**Collaboration**:
- OODS-registry drift: do you want Stage1 to push these divergence reports to you via message (`intel_push`?), or is a polled artifact fine? Our default: emit as part of `reconciliation_report.conflicts[]` with a new severity tier. Your UI decides what to do.
- Write-side loop closure: once patch verdicts have been trusted for a few sprints, we could discuss **automated registry mutation** under confidence threshold. That's a later-sprint topic, but flagging now.

---

## Coordination channels

- **Planning docs** (this one, plus Stage1's [sprint-43-roadmap.md](../../../../Stage1/cmos/planning/sprint-43-roadmap.md)): for substantive scope + architecture discussions.
- **CMOS messages**: for heads-ups, status updates, specific asks (`info_push`, `question`, `intel_request`).
- **TraceLab**: for evidence attached to messages (e.g., example reconciliation_report payloads).
- **Sibling repos**: If OODS wants to sketch a response/counter-proposal, write to `OODS-Foundry-mcp/cmos/planning/` and drop a `reference` pointer back in a CMOS message. Stage1 agents will pick it up.

---

## Timeline (our side, best guess)

- **Sprint 43**: in-progress. Expect v1.3.0 contract + first reconciliation runs within ~1-2 weeks depending on agent throughput.
- **Sprint 44+**: gate on 43 close. No hard deadline but following the same cadence.
- The Sprint 43 gate mission (m06) includes an `info_push` to OODS announcing v1.3.0 availability when the contract publishes. Expect that message as the "green light" to build the write-side.

---

## What we'd like back from OODS

Whenever convenient — not blocking Sprint 43:

1. **Confirmation or pushback** on the reconciliation verdict semantics (create/patch/skip/conflict as defined above).
2. **Registry fetch shape** — are list+resolve okay, or do you want us to build against a bulk-snapshot tool if you build one?
3. **Write-side sprint scoping** — rough ETA for when OODS could ship `oods_apply_reconciliation` or equivalent.
4. **Positions on Sprints 44-47 open questions** — especially review-decision persistence (S44), capability as entity vs. property (S45), and signals visibility (S46).

Happy to iterate here or over CMOS messages — whichever works better for your cadence.

— Stage1 team

# Response Draft — Stage1 Sprint 43 Handoff

**Status**: Draft, pre-send. Pending user review.
**Target**: `cmos://derek/stage1`
**Type**: `status_update`
**Responds to**: message `1cbd99af-ad9f-411d-9175-63e149a8e4d6` (info_push, 2026-04-16)
**Summary**: `OODS ack + positions: building write-side (map.apply + registry.snapshot) for sprint 90, S44–47 positions inline`

---

## Message body (as it will send)

Thanks for the early handoff — timing works well on our side. Sprint 89 just closed and we have room to plan sprint 90 around v1.3.0.

Attaching our draft plan: `OODS-Foundry-mcp/cmos/planning/sprint-90-plan.md`. Substance below; the plan has the fuller rationale.

### 1. Reconciliation verdict semantics — confirming, with one open question

Confirming `create | patch | skip | conflict` as defined. Verdict semantics land cleanly against our existing `map.create / update / resolve / delete` family — routing is one-to-one:

- `create` → `map.create` (with our existing `apply:true` gate preserved)
- `patch` → `map.update` consuming `diff.changed[]` as the partial update set
- `skip` → no-op + audit log
- `conflict` → write to our conflict artifact; no mutation

**Open question back to you**: what happens to candidates that scored above your emission floor but below an OODS confidence threshold? Three options:

- **a)** You filter pre-emission (reconciliation_report only contains actionable candidates — clean but loses trace data).
- **b)** We filter post-receipt (a tool param `minConfidence`, default 0.75, routes sub-threshold verdicts to a "review" bucket on our side). **Our lean.**
- **c)** You add a `reject` verdict (symmetric to `skip`, but signals "don't apply" rather than "no change needed").

We're leaning (b). It lets agents tune gating per-session rather than per-deploy, and keeps your emitter honest — you send everything above your floor, we decide what to apply. If you agree, we don't need a `reject` verdict at all.

### 2. Registry fetch — proposing `registry.snapshot`

`map.list` is unpaginated today (hard truth: no soft/hard cap, single-response). At small scale that's fine; at 500+ maps it's not. Two things planned in sprint-90:

- **New tool `registry.snapshot`** — single bulk-read returning `{ maps, traits, objects, etag, generatedAt }`. This is our preferred path for your s43-m02 reconciliation consumer. Stable etag lets you detect registry drift between your capture and our state.
- **Pagination on `map.list`** — defense-in-depth, back-compat preserved. Cursor-based, `limit` default 100 / max 500.

If your s43 is already wired against `map.list` + N× `map.resolve`, don't refactor — ship against what works and migrate to `registry.snapshot` when it's convenient (we'll announce in s90-m06). `map.resolve` is safe to batch today; it's read-only over the same loaded mapping doc.

### 3. Write-side consumer — `map.apply`

Tool name is `map.apply`, not `oods_apply_reconciliation`. Lives in the `map.*` family. Two UX choices worth flagging explicitly because they're non-negotiable from our side:

- **Defaults to dry-run.** `apply: false` is the default, matching `map.create` and `brand.apply` in this repo. An agent driving the tool inspects the routed verdicts before committing. We actively refuse to ship a default-mutate flavor.
- **Confidence gating is a tool parameter (`minConfidence`), not deploy config.** Rationale: different agent sessions want different risk tolerances. A careful cross-check session wants 0.85; a bulk-ingest against a trusted source wants 0.60. Deploy-wide config is wrong abstraction for this.

Input accepts both inline `report: ReconciliationReport` and `reportPath: string` — discriminated union, exactly one required. Avoids forcing filesystem round-trips for small runs.

Output: `{ applied, skipped, queued, conflicted, errors, diff, conflictArtifactPath, etag }`. Conflicts land in `.oods/conflicts/<timestamp>-<run_id>.json` as first-class inspectable artifacts.

ETA: sprint-90 is 6 missions, not rushed. Best guess ~2–3 sittings. Integration gate (s90-m06) waits on a real reconciliation_report from your end — see ask below.

### 4. One ask back to you

Could you emit one synthetic or real `reconciliation_report.json` at v1.1.0 shape before your s43-m03 lands? Even with `verdict: 'create'` on every entry is fine. We want to write our contract tests against the actual emitter shape rather than our own interpretation of the schema. If v1.1.0 isn't stable yet that's totally fine — we'll use synthetic fixtures and rework in s90-m06.

### 5. Positions on sprints 44–47

Taking positions so you can plan around them. All open to pushback.

**Sprint 44 — review-decision persistence.** Option C (sidecar → OODS promotion). Disambiguation during an active review is run-scoped; once promoted to canonical, it belongs in the OODS registry. We'll host promoted decisions as a new `canonical_term` or `disambiguation` entity — shape to bike-shed together when S44 kicks off. Yes to a `disambiguation_decisions[]` field on the reconciliation_report so decisions flow through the bridge; bake it into v1.4.0 contract.

**Sprint 45 — capability as entity vs. property.** First-class entity. One capability ("Create User") spans multiple surfaces (button, modal, form). Making it a property forces 1:N denormalization and we lose the cross-surface identity story. An entity lets us attach signals, preconditions, and API linkage in one place, and it aligns naturally with how OODS already models traits. Emit capability entities directly; we'll add the receiver-side schema.

On `projection_variants[]` — yes, add to the bridge payload. We'll add matching registry support on our side before S45 close.

On lifecycle clustering — agree with your direction. Stage1 infers observed states → emits them. OODS maps to canonical lifecycle traits. Data flows one-way from observation to canonicalization.

**Sprint 46 — signals visibility.** Surface `signals[]` to end consumers (codegen output, design.compose responses), not just bridge-internal. Generated code that annotates *why* a trait was chosen is dramatically easier to debug. For agent consumers especially — when a generation looks wrong, the signal chain is the thing you need. Yes to v1.4.0 additive bump.

We'll keep `reasoning: string` as a rendered-from-signals convenience field for now — saves consumers from having to re-render every call.

**Sprint 47 — drift push vs. poll.** Start with poll. `reconciliation_report.conflicts[]` with a new severity tier for registry-drift is fine. Push is premature — we want to see the cadence first. Automated patch-verdict application we'll revisit after v1.3.0 has a few months of real use; not committing either way now.

---

## What's NOT in this response

Flagging what we consciously didn't commit to, so you know it's on our radar but not decided:

- Confidence threshold number — we said 0.75 as our default, but happy to discuss if your emission floor suggests a different calibration point.
- Whether Stage1-promoted decisions become OODS registry entries automatically or require a human/agent gate — S44 conversation.
- Whether signals surface verbatim or get transformed for end-consumer readability — S46 conversation.

---

## Meta

- Planning doc this references: [sprint-90-plan.md](./sprint-90-plan.md)
- Stage1 handoff this responds to: [stage1-sprint-43-handoff.md](./stage1-sprint-43-handoff.md)
- On send: also call `cmos_message(action='respond', messageId='1cbd99af-…', respondStatus='replied')` to close the loop on their original info_push.

# Sprint 90 — Reconciliation Write-Side Loop

**Status**: Draft plan, pre-approval.
**Theme**: Close the write-side of the Stage1 reconciliation loop. When Stage1 ships bridge contract v1.3.0, OODS is ready to consume verdicts and apply them to the registry.
**Pace**: Quality-first. Not a rush sprint. Expect ~2–3 sittings.
**Dependency**: Coordinating with Stage1 sprint-43 delivery — this sprint can land contract work ahead of their ship; integration gate waits on their artifact.

Stage1 handoff doc: [stage1-sprint-43-handoff.md](./stage1-sprint-43-handoff.md)
Response draft (pre-send): [stage1-sprint-43-response-draft.md](./stage1-sprint-43-response-draft.md)

---

## Why this sprint matters

OODS MCP is the flagship. Stage1 is the differentiator that turns observed evidence into design-system knowledge. Today the loop is half-closed: Stage1 emits candidates, but the write path back into our registry hardcodes `action: 'create'`. When v1.3.0 ships, Stage1 will emit real verdicts (`create | patch | skip | conflict`) and we need to apply them without dropping fidelity or surprising the agent driving the call.

This sprint builds the write-side consumer that makes the full loop real.

---

## Design decisions (pre-committed)

These are the choices we're making up front so the missions below can execute cleanly. All are open to pushback during review.

### Tool name: `map.apply`, not `oods_apply_reconciliation`

- Lives in the `map.*` family alongside `map.create / update / list / resolve / delete`.
- Stage1's suggested name bakes their terminology into our surface. Our convention is dotted, verb-scoped, and registry-anchored.
- Input is a reconciliation report, but the *action* is "apply verdicts to the map registry." Matches our naming grammar.

### Default-safe: `apply: false` by default, mirroring `map.create` and `brand.apply`

- The existing convention in this repo: mutation tools default to dry-run. See [map.create.ts:22](../../packages/mcp-server/src/tools/map.create.ts#L22) — `const applied = input.apply === true`.
- `map.apply` inherits the same flag and semantics. Agents can inspect the routed verdicts before committing. This is the single most important agent-UX choice on the tool.

### Confidence gating as a tool parameter, not deploy-time config

- Stage1 suggested three modes (conservative / aggressive / advisory) or a config-file threshold. Both force the decision away from the point of use.
- **Instead**: `minConfidence: number` parameter, default `0.75`. Verdicts below threshold become `review` instead of applying. Agents tune per-session, not per-deploy.
- Rationale: an agent doing a careful cross-check session wants 0.85; an agent bulk-ingesting a trusted source wants 0.60. Deploy-wide config is wrong abstraction.

### Input accepts both inline payload and path (discriminated)

- `{ report: ReconciliationReport }` — inline JSON for small/synthetic runs.
- `{ reportPath: string }` — filesystem path for large artifacts or CI pipelines.
- Exactly one is required. Rejecting both-or-neither at the schema layer.
- Rationale: forcing a filesystem round-trip for every apply call is ergonomic friction. Supporting both costs ~10 lines.

### Conflict queue is a filesystem artifact, not a new entity type

- Conflicts write to `.oods/conflicts/<iso-timestamp>-<run_id>.json`.
- Inspectable with existing filesystem tools. Greppable. Version-controllable per-adopter preference.
- **Not** adding `conflict.*` tools in this sprint. If usage pressure justifies one later, we add `conflict.list` + `conflict.show`. YAGNI for now.

### `registry.snapshot` as preferred registry-fetch path

- New bulk-read tool returns `{ maps, traits, objects, etag, generatedAt }` in one call.
- Addresses Stage1's concern about batching `map.list` + N× `map.resolve`.
- `map.list` stays available and gets a light pagination pass (see m04) as defense-in-depth.

### What we are NOT accepting unilaterally

- `reject` verdict — if Stage1 wants one-way filtering, we prefer to gate on our side via `minConfidence`. Asked in the response draft.
- `disambiguation_decisions[]` in the reconciliation_report — S44 scope. Not in this sprint.
- Automated patch-verdict application without dry-run — actively refusing. Human or agent inspection must be the default.

---

## Missions

### s90-m01 — `map.apply` spec + contract tests

**Scope**: Author the tool contract before writing the implementation. Freeze the input/output shape and the verdict-routing semantics.

**Deliverables**:
- `packages/mcp-server/src/tools/types.ts` — `MapApplyInput` and `MapApplyOutput` types.
- `packages/mcp-server/test/contracts/map-apply.spec.ts` — contract tests covering: dry-run vs. applied, verdict routing (create / patch / skip / conflict), `minConfidence` gating, error aggregation, etag threading.
- `docs/mcp/Tool-Specs.md` — new section for `map.apply`.
- Example reconciliation_report fixture at `packages/mcp-server/test/fixtures/reconciliation-report-v1.1.0.json` (synthetic; request real from Stage1 in parallel).

**Success criteria**:
- Contract tests compile and fail (implementation not yet wired).
- Input schema validates at MCP layer — both `report` and `reportPath` variants.
- Output shape includes `applied | skipped | queued | conflicted | errors | diff | conflictArtifactPath | etag`.

### s90-m02 — `map.apply` implementation

**Scope**: Implement verdict routing. Delegate to existing `map.create` / `map.update` / `map.resolve` handlers rather than duplicating CRUD logic.

**Deliverables**:
- `packages/mcp-server/src/tools/map.apply.ts`.
- Verdict router: `create` → `map.create.handle({ ...payload, apply })`, `patch` → `map.update.handle({ id, updates: diff.changed.map(...) })`, `skip` → no-op with audit log, `conflict` → append to conflict artifact.
- Below-threshold verdicts route to `queued` (in-memory list) and also land in the conflict artifact under a `belowConfidence` key.
- Idempotence: re-applying the same report with `apply: true` must produce an identical etag.

**Success criteria**:
- Contract tests from m01 pass.
- E2E test: canned 20-verdict report → dry-run report → apply → verify registry state → verify conflict artifact shape.
- Zero new dependencies.

### s90-m03 — `registry.snapshot` bulk-read tool

**Scope**: Single-call bulk read of registry state for Stage1 consumption.

**Deliverables**:
- `packages/mcp-server/src/tools/registry.snapshot.ts`.
- Output: `{ maps: ComponentMapping[], traits: Record<string, TraitInfo>, objects: Record<string, ObjectInfo>, etag: string, generatedAt: string }`.
- Types + contract tests.
- Tool-Specs.md entry.

**Success criteria**:
- Returns full registry in one call.
- `etag` stable across unchanged registry state.
- Benchmarked at 100 / 500 / 1000 maps — confirm < 200ms p99 at 1000.

### s90-m04 — `map.list` pagination + audit

**Scope**: Add cursor-based pagination to `map.list` as defense-in-depth. Stage1's backup path if they don't migrate to `registry.snapshot`.

**Deliverables**:
- `map.list` accepts `{ cursor?: string, limit?: number (default 100, max 500) }`.
- Response includes `nextCursor?: string`.
- Existing unpaginated behavior preserved when no cursor/limit supplied (back-compat).
- Benchmark at 1000+ maps.

**Success criteria**:
- Existing `map.list` callers unchanged.
- New paginated callers get cursor threading.
- Contract test for cursor stability across concurrent creates.

### s90-m05 — Full surface registration

**Scope**: Every new tool registered across every surface. The S80 lesson (disjoint registry/renderer sets → integration failure) applies here. Audit, don't assume.

**Deliverables**: `map.apply` and `registry.snapshot` registered in:
- `packages/mcp-server/src/tools/registry.json`
- `packages/mcp-server/src/tools/registry.ts`
- `packages/mcp-server/src/security/policy.json`
- `packages/mcp-server/src/schemas/generated.ts`
- `packages/mcp-adapter/tool-descriptions.json`
- `packages/mcp-bridge/` — whatever surface it exposes
- `packages/mcp-server/src/index.ts` — MCP export
- Error codes catalog — any new error codes introduced

**Success criteria**:
- Grep audit: tool name appears in all 8 surfaces listed above.
- `pnpm test` green across repo.
- Adapter descriptions readable by a fresh agent — not jargon-dense.

### s90-m06 — Integration gate + Stage1 handshake

**Scope**: End-to-end validation against a real Stage1 reconciliation_report, not a synthetic one. Publish status back to Stage1.

**Deliverables**:
- Request from Stage1 (via cmos_message): one real reconciliation_report.json from their linear.app or stripe.com post-S40 run.
- E2E test that ingests it, routes all verdicts, verifies against expected registry state.
- `info_push` to Stage1 confirming write-side availability, attaching our tool contracts and a sample agent-driven apply transcript.
- Update roadmap + memory: mark v1.3.0 consumer live.

**Success criteria**:
- Real Stage1 artifact applied clean.
- No ad-hoc fixes during integration (that signals drift between our spec and their emitter — flag if it happens).
- Stage1 acknowledges receipt.

---

## Out of scope

Explicitly deferred so this sprint stays focused:

- **`conflict.list` / `conflict.show` tools** — filesystem artifact is enough for v1. Revisit when we see real queue volume.
- **`review.resolve` + disambiguation persistence** — Sprint 44 (Stage1 side) territory. Decision needed on shape, not yet.
- **`capability.*` tools** — Sprint 45 territory. Position taken in response draft.
- **`signals[]` surfacing in code.generate / design.compose output** — Sprint 46. Nice-to-have, separable work.
- **Automated patch-verdict apply (no dry-run gate)** — not shipping. Human/agent inspection is the default, full stop.
- **Push-based drift notifications** — Sprint 47 discussion. Polling via reconciliation_report is fine for now.

---

## Agent UX notes

Since the user explicitly flagged "these tools are for agents like yourself" — here's the UX model we're committing to:

1. **Default dry-run.** Every mutation tool in this sprint returns the plan before executing. `map.apply` inherits the `apply: true` pattern from the existing family.
2. **Surgical inputs, fat outputs.** The tool takes minimal parameters and returns a structured report (`applied / skipped / queued / conflicted / errors / diff`). Agents should be able to drive decision-making from the output without re-fetching state.
3. **Inline + path inputs.** Don't force a filesystem round-trip for small reports. Don't force inline for giant ones. Discriminated union handles both.
4. **No hidden retries.** If a verdict fails to apply, it lands in `errors` with the Stage1-emitted reasoning and our error chain. Agent decides whether to retry, not the tool.
5. **Etags everywhere.** Every response carries the post-state etag. Lets agents detect concurrent mutation between dry-run and apply.
6. **Self-describing conflict artifacts.** Each conflict file includes the Stage1 verdict payload + our rejection reason + a suggested next action (apply with `--force`, queue for review, ignore). So an agent reading the artifact can decide without re-fetching.

If anything in this list turns out to feel wrong when we're actually driving the tool, that's worth flagging mid-sprint and revising. We are not precious about these choices.

---

## Success metric for the sprint

Not "tests pass." The bar is:

> A fresh agent, handed a Stage1 reconciliation_report and our tool contracts, can apply it to the registry without reading any source code.

That's the test. If the agent stumbles, the tool UX failed regardless of test coverage.

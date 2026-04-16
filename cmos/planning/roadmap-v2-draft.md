# OODS Foundry MCP — Roadmap V2 Draft

> Updated: 2026-04-16
> Status: Draft for Sprint 91 closeout / Sprint 92+ planning
> Cross-reference: [roadmap-v1.md](./roadmap-v1.md)

V1 reached `100/100` and the write-side loop is now live. V2 should not reopen already-closed baseline categories just to create motion. The shift is from "can OODS do the core job?" to "can an agent operate the full Stage1 -> OODS loop quickly, safely, and with enough observability to trust it at scale?"

## Scoring Model

- Score each axis from `0-5`.
- Weighted score formula: `(axis_score / 5) * axis_weight`.
- Total target remains `100`.
- Any regression against the V1 baseline gates below caps the overall V2 score at `79` until the regression is fixed.

## What Carries Forward From V1

These stay mandatory, but they should behave as release gates rather than frontier scoring categories.

| Baseline gate from V1 | 2026-04-16 state | V2 treatment |
| --- | --- | --- |
| Core compose -> validate -> render -> code.generate path | Stable and fully shipped | Non-negotiable regression gate |
| Cross-framework parity and styling matrix | Validated across React, Vue, HTML | Non-negotiable regression gate |
| Default-safe mutation model (`apply: false`, explicit dry-run) | Established in `map.apply`, `brand.apply`, `map.create` family | Product principle, not a score axis |
| Contract-first tool delivery | Mature across schemas, server types, SDK types, and contract tests | Must remain true for every new surface |
| Documentation and discoverability floor | Good enough for V1 release | Measured as part of operator ergonomics, not as standalone documentation points |

## What Is Considered Closed From V1

These are done enough that V2 should treat them as platform foundations, not as open roadmap questions.

| Closed V1 objective | Evidence in [roadmap-v1.md](./roadmap-v1.md) | V2 implication |
| --- | --- | --- |
| Core platform quality reached `100/100` | All V1 score categories are full | V2 should introduce new frontier axes instead of re-scoring the same ones |
| Write-side reconciliation consumer exists | `map.apply`, `registry.snapshot`, paginated `map.list`, and real-data re-gate are live | V2 measures workflow quality on top of the write-side, not whether the write-side exists |
| Playground compose workflow exists | Compose, preview, save-schema, and code panel are already shipped | V2 should focus on operator workflow depth, not initial scaffolding |
| Real-data Stage1 demo exists in the playground | `#stage1` demo route now loads real on-disk reports through `map.apply` dry-run | V2 should focus on tuning, recovery, and operator actions beyond a read-only demo |

## Candidate V2 Axes

| Axis | Weight | Current state as of 2026-04-16 | Measurable success criterion |
| --- | ---: | --- | --- |
| Stage1 round-trip ergonomics | 20 | Real Stage1 reports can be dry-run through `map.apply`, but the agent still hand-drives inspect -> review -> apply across multiple tools and artifacts. | A fresh agent can complete dry-run -> review -> apply for a real `reconciliation_report.json` in `<= 3` primary tool calls and `<= 90s` median local round-trip time, with no source-code reading required. |
| Review and recovery workflows | 15 | Queued and conflicted buckets exist, plus filesystem conflict artifacts, but recovery is still manual and artifact-driven. | Every queued or conflicted item can be accepted, patched, deferred, or dismissed through a documented workflow with zero manual JSON editing, and `100%` of conflict artifacts include machine-readable remediation hints. |
| Playground operator DX | 15 | The playground now demonstrates Stage1 dry-run routing against real fixtures, but it is still a read-oriented demo rather than a full operator cockpit. | An operator can switch fixtures, tune thresholds, inspect diffs, and export or capture a dry-run transcript in one session with `<= 2` view changes per task and no bridge restarts. |
| Code generation coverage for evidence-backed flows | 15 | Codegen parity is strong for generic design schemas, but reconciliation-driven operator surfaces are still represented mostly as example snippets. | At least `3` common reconciliation surfaces (`review queue`, `conflict detail`, `apply summary`) generate cleanly across React, Vue, and HTML with all supported styling modes and no manual patch-up. |
| Registry knowledge model depth | 15 | `disambiguation_decisions`, `preferred_term`, `capability`, and `projection_variants` stubs now exist in schemas and public types, but they are not yet live in handlers or registry flows. | Capability identity, preferred terms, and projection variants round-trip through schemas, tool inputs/outputs, and `registry.snapshot` without lossy translation, backed by `>= 2` end-to-end contract fixtures. |
| Observability and drift telemetry | 10 | ETags, diff summaries, and conflict artifacts exist, but there is no consolidated write-side latency, drift, or failure trend surface. | Every write-side run emits latency, bucket counts, schema version, and drift markers, and the repo can compare at least `3` historical runs without ad-hoc scripting. |
| Scale, determinism, and release confidence | 10 | Repo-wide build and test posture is strong, but write-side confidence still leans heavily on a small number of real fixtures and targeted benches. | Release gates include representative real artifacts plus published thresholds for `100 / 500 / 1000` mapping states, and the write-side path passes without requiring serialized-only execution to stay green. |

## Recommended Reading Of The Draft

This draft implies three practical moves for Sprint 92+:

1. Keep V1 fundamentals as hard gates, not as points to re-win.
2. Spend V2 points on full-loop operator experience and registry-model depth.
3. Prefer evidence-backed scoring criteria that can be re-run from fixtures, artifacts, or reproducible benchmarks.

## Non-Goals For V2 Scoring

- Re-litigating whether the base MCP tool surface is "good enough" for launch.
- Awarding points for documentation churn that does not materially reduce agent/operator friction.
- Treating one-off synthetic success as equivalent to repeated real-artifact evidence.

## Proposed First Checkpoint

Run the first V2 score only after the next sprint lands at least one of:

- A first-class review or recovery flow for queued/conflicted reconciliation items.
- A richer Stage1 operator workflow in the playground beyond read-only dry-run inspection.
- Live handler support for one of the new registry-model entities introduced as v1.4.0 stubs.

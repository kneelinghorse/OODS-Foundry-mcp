# s59-m07 schemaRef Passthrough Audit

- Date: 2026-03-04
- Scope: design.compose → repl.validate → repl.render → code.generate using schemaRef

## Summary
schemaRef passthrough is working end-to-end across validate/render/code.generate and materially reduces request payload size versus resending full schemas.

## E2E Pipeline Check
- compose → validate → render → code.generate with schemaRef: PASS
- New test coverage: `tests/e2e/schema-ref-pipeline.test.ts`

## Payload Size Comparison
Measured for intent: "Account detail view with tabs for Overview, Billing, Activity, Settings." (detail layout, 4 tabs)

| Tool | schema payload (bytes) | schemaRef payload (bytes) | Reduction |
| --- | --- | --- | --- |
| repl.validate | 1,768 | 46 | 97.4% |
| repl.render (apply=true) | 1,781 | 59 | 96.7% |
| code.generate (react) | 1,774 | 52 | 97.1% |
| **Total** | **5,323** | **157** | **97.1%** |

## Notes / Gaps
- schemaRef is process-local and in-memory (TTL default 30 minutes; max 250 entries). It will not survive server restarts and can evict older refs under load. Env overrides: `MCP_SCHEMA_REF_TTL_MS`, `MCP_SCHEMA_REF_MAX`.
- schemaRef is supported only for `mode: full` in repl.validate/repl.render; patch mode still requires explicit baseTree + patch by design.

## Recommendation
- No blocking gaps observed for schemaRef passthrough in the compose → validate → render → code.generate flow.
- Consider documenting TTL/eviction behavior in MCP Tool-Specs to set expectations for long-lived clients.

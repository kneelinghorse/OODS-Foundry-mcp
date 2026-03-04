# s59-m08 Mapping Tool Maturation

- Date: 2026-03-04
- Scope: map.create, map.list, map.resolve

## Summary
- map.create now respects `apply` (dry-run by default), reports whether changes were persisted, and emits agent-friendly errors for duplicate mappings.
- map.resolve not-found message now includes actionable guidance.
- E2E mapping workflow covers two external systems (material + chakra) via the MCP bridge.

## E2E Coverage
- `packages/mcp-server/test/e2e/mapping-versioning.e2e.spec.ts`
  - map.create → map.list → map.resolve using `material` and `chakra`

## Error Handling Improvements
- Duplicate mapping returns `status: "error"` with `errors.message` + `errors.details` shaped like `formatValidationErrors()`.
- map.create includes `applied` boolean and a dry-run warning when `apply` is false.
- map.resolve not-found message recommends map.list or map.create with `apply: true`.

## Known Limitations (Needs Usage Feedback)
- No update/delete API for existing mappings (create/list/resolve only).
- Storage is a single JSON artifact; no concurrency control beyond last-write-wins.
- No validation that `oodsTraits` / `oodsProp` names exist or are compatible beyond warnings.
- No conflict resolution or merging for concurrent edits.
- No version history or audit trail beyond mapping metadata + file timestamps.
- `apply: false` returns a dry-run warning but no diff/preview of file changes.
- Mapping IDs are slugified; external system naming conventions are not normalized beyond case-insensitive lookup.

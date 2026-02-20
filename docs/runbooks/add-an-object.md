# Runbook: Add an Object

## Intent
- New object composes traits, resolves conflicts, and validates with compose checks.
- Object definition is ready for registry + generated types if canonical.

## Files You Will Touch
- objects/<domain>/<ObjectName>.object.yaml - object definition
- generated/objects/* (optional) - regenerated types for canonical objects
- stories/domains/<Domain>/*.stories.tsx (optional) - previews with RenderObject

## Commands to Run
```bash
pnpm object:create -- <ObjectName> --dir objects/<domain>
pnpm object:validate -- --compose
pnpm object:resolve -- <ObjectName> --json
```

## Expected Artifacts
- New `.object.yaml` file with `object`, `traits`, `schema`, and `resolutions`
- Compose output shows trait order and no unresolved conflicts

## Common Failure Modes
| Symptom | Cause | Fix |
| --- | --- | --- |
| `UNKNOWN_TRAIT` or missing trait | Trait path/name not found | Use `category/TraitName` and verify under `traits/` |
| `DUPLICATE_ALIAS` | Two traits share the same alias | Rename one alias and re-run compose |
| Field collision errors | Same field name from multiple traits | Add `resolutions.fields` to pick the source |
| Parameters invalid | Trait parameters do not match schema | Re-check trait parameter schema and values |

# Runbook: Add a Trait

## Intent
- New trait definition exists under the right category and validates cleanly.
- Trait scope is one capability (schema + optional semantics/view extensions).

## Files You Will Touch
- traits/<category>/<TraitName>.trait.yaml (or .ts) - trait definition
- traits/<category>/<TraitName>.trait.ts (optional) - only if logic is too complex for YAML
- tests/traits/<domain>/*.test.ts (optional) - validation or helper coverage

## Commands to Run
```bash
pnpm validate -- --path traits
pnpm validate:dependencies -- --path traits
```

## Expected Artifacts
- New trait file in `traits/<category>/` with `trait` metadata + `schema`
- Validation output shows zero errors for the new trait

## Common Failure Modes
| Symptom | Cause | Fix |
| --- | --- | --- |
| "Missing required field 'trait'" | Trait metadata not present | Add `trait.name` and `trait.version` blocks |
| "Missing required field 'schema'" | Schema omitted | Add `schema: {}` at minimum |
| Duplicate trait name | File name or `trait.name` collides | Rename the trait and update references |
| Dependency validation errors | `dependencies` or required traits missing | Add required traits or mark optional |

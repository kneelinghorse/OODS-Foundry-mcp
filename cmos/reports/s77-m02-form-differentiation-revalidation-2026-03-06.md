# Sprint 77 Mission 02 — Field-Type Form Differentiation Dist Revalidation

**Mission:** `s77-m02`  
**Date:** 2026-03-05 22:12 CST / 2026-03-06 UTC  
**Scope:** Revalidate mixed-field form differentiation on latest dist and close the ranking gap that still let generic `Input` beat `Select` / `Textarea` in main form slots.

## Summary

The mixed-field `Subscription` form path now differentiates the key control types correctly on both source and rebuilt dist:

- `enum-input` → `Select`
- `boolean-input` → `Checkbox`
- `date-input` → `DatePicker`
- `long-text-input` → `Textarea`

The fix came from tightening position affinity so generic `Input` no longer receives a main-slot boost that can outrank specialized form controls. `Select` and `Textarea` now receive the main/tab affinity they were missing.

## Implementation Notes

- Updated `packages/mcp-server/src/compose/position-affinity.ts`:
  - removed the `main` boost from generic `Input`
  - added main/tab boosts for `Select` and `Textarea`
- Added executed selector coverage in `packages/mcp-server/test/compose/component-selector.spec.ts` for `enum-input` and `long-text-input` in main form slots.

## Verification

### Source tests

Command:

```bash
pnpm exec vitest run \
  packages/mcp-server/test/compose/component-selector.spec.ts \
  packages/mcp-server/test/compose/form-field-differentiation.spec.ts
```

Result: pass

### Latest-dist validation

Command sequence:

```bash
pnpm --filter @oods/mcp-server run build
node --input-type=module - <<'EOF'
import { handle } from './packages/mcp-server/dist/tools/design.compose.js';
const result = await handle({
  object: 'Subscription',
  context: 'form',
  preferences: { fieldGroups: 5 },
});
EOF
```

Observed result:

- `layout: "form"`
- `validation.status: "ok"`
- `enum-input` selected `Select`
- `boolean-input` selected `Checkbox`
- `date-input` selected `DatePicker`
- `long-text-input` selected `Textarea`

## Remaining Narrowed Watchlist

The form-differentiation watchlist is now narrowed, not eliminated:

- planned billing form widgets (`BillingIntervalSelector`, `BillingAmountInput`) still emit `OODS-V120` because they are not stable catalog entries yet
- the mixed-field fallback behavior is now correct even when those planned trait components are skipped

## Mission Outcome

Success criteria satisfied:

1. Latest-dist validation confirms differentiated controls for boolean, enum, date, and long-text fields.
2. No schema-validity regression was introduced.
3. The roadmap watchlist can be narrowed with concrete latest-dist evidence.

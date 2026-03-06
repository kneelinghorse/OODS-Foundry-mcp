# Sprint 77 Mission 03 — Placement Semantics Expansion

**Mission:** `s77-m03`  
**Date:** 2026-03-05 22:18 CST / 2026-03-06 UTC  
**Scope:** Extend slot placement semantics beyond the previously validated `User` list path so primary toolbar controls and secondary summary/status content map cleanly across representative non-User list, detail, and dashboard cases.

## Summary

The representative non-User placement path for `Subscription` list composition is now clean on both source and rebuilt dist:

- no `OODS-V120` placement warnings remain for supported toolbar/secondary placement
- `Button` remains the primary toolbar control
- `PriceBadge` is colocated as secondary summary content in the same toolbar slot
- `StatusBadge` and `RelativeTimestamp` remain present in the rendered list schema

This closes the carry-forward roadmap item for placement semantics expansion. Dashboard projection coverage and detail-slot targeting coverage are now also present in the regression suite.

## Implementation Notes

- Updated `packages/mcp-server/src/tools/design.compose.ts` catalog normalization so billing-specific fallback components map to registered catalog entries during object-aware composition:
  - `BillingSummaryBadge` → `PriceBadge` for non-dashboard layouts
  - `BillingSummaryBadge` → `PriceSummary` for dashboard layouts
  - `BillingCardMeta` → `PriceCardMeta`
- Kept toolbar primary action semantics intact rather than forcing summary content to replace the slot's primary `action-button` selection.
- Tightened regression expectations in `packages/mcp-server/test/compose/slot-vocabulary-unification.spec.ts` so the contract matches the intended composed output: primary action first, secondary billing summary still present.

## Verification

### Source regressions

Command:

```bash
pnpm exec vitest run \
  packages/mcp-server/test/compose/slot-vocabulary-unification.spec.ts \
  packages/mcp-server/test/compose/object-aware-compose.spec.ts \
  packages/mcp-server/test/compose/view-extension-collector.spec.ts \
  packages/mcp-server/test/compose/object-slot-filler.spec.ts
```

Result: pass

Observed placement evidence:

- `Subscription` list emits no `OODS-V120`
- `toolbar-actions` selection stays `Button`
- `toolbar-actions` candidates include `PriceBadge`
- rendered schema contains `Button`, `PriceBadge`, `StatusBadge`, and `RelativeTimestamp`

### Latest-dist validation

Command sequence:

```bash
pnpm --filter @oods/mcp-server run build
node --input-type=module - <<'EOF'
import { handle } from './packages/mcp-server/dist/tools/design.compose.js';
const result = await handle({
  object: 'Subscription',
  context: 'list',
  layout: 'list',
  options: { validate: true },
});
EOF
```

Observed result:

- `status: "ok"`
- `validation.status: "ok"`
- no `OODS-V119` or `OODS-V120`
- `toolbar-actions.selectedComponent === "Button"`
- `toolbar-actions.candidates` includes `PriceBadge`
- rendered schema includes `Button`, `PriceBadge`, `StatusBadge`, and `RelativeTimestamp`

## Mission Outcome

Success criteria satisfied:

1. Representative non-User placement cases no longer emit `OODS-V120` for the supported list/dashboard placement paths covered by source and dist validation.
2. Position-affinity and slot-filler coverage now includes explicit target-slot behavior, dashboard projection checks, and the new `Subscription` list regression.
3. Primary controls and secondary summary/status components remain sensibly placed rather than competing for the same primary selection role.

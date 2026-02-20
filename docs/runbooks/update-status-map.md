# Runbook: Update Status Map

## Intent
- Billing status mappings update with the correct tokens and render in StatusChip.
- Lint checks prevent literal status usage or tone drift.

## Files You Will Touch
- tokens/maps/saas-billing.status-map.json - source of truth for subscription/invoice
- apps/explorer/src/stories/StatusChip.stories.tsx - visual verification cases
- apps/explorer/src/components/StatusChip.tsx (optional) - only for new domains

## Commands to Run
```bash
pnpm lint:enum-map
pnpm build:tokens
pnpm test apps/explorer/__tests__/smoke.context.spec.tsx
```

## Expected Artifacts
- Updated `tokens/maps/saas-billing.status-map.json` entries
- StatusChip renders new statuses with correct tone + icon

## Common Failure Modes
| Symptom | Cause | Fix |
| --- | --- | --- |
| lint:enum-map fails | Literal status strings in code | Replace with token map-driven values |
| StatusChip shows neutral tone | Token reference missing tone keywords | Use `color.text.*` / `color.background.*` tokens with tone names |
| Icon shows bullet glyph | Icon name missing or invalid | Use a valid `icon.status.*` name |
| Storybook mismatch | Story not updated with new status | Add a story entry for the new status |

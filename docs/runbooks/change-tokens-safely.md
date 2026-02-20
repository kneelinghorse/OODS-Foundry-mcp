# Runbook: Change Tokens Safely

## Intent
- Token edits follow the 4-layer model and rebuild without guardrail failures.
- Generated outputs are updated for CSS, TS, and Tailwind consumers.

## Files You Will Touch
- packages/tokens/src/tokens/base/** - reference and system tokens
- packages/tokens/src/tokens/brands/<A|B>/*.json - brand overlays
- packages/tokens/src/tokens/themes/<theme>/*.json - theme ramps (dark, hc, etc.)
- tokens/semantic/system.json - system semantic bindings
- tokens/semantic/components.json - component slots
- apps/explorer/src/styles/layers.css - component slot mappings

## Commands to Run
```bash
pnpm build:tokens
pnpm tokens-validate
# Optional for PR guardrails or protected namespaces
pnpm tokens:governance diff --brand A --base main --head HEAD \
  --json artifacts/tokens/brand-a-report.json \
  --comment artifacts/tokens/brand-a-comment.md
```

## Expected Artifacts
- packages/tokens/dist/css/tokens.css
- packages/tokens/dist/ts/tokens.ts
- packages/tokens/dist/tailwind/tokens.json

## Common Failure Modes
| Symptom | Cause | Fix |
| --- | --- | --- |
| Duplicate token name/variable | Two tokens resolve to same name | Rename or move one token path |
| tokens:lint-semantic fails | Component token maps to invalid system token | Update `tokens/semantic/*.json` references |
| Brand token mismatch | Brand overlay missing a required key | Add the missing token to the brand file |
| Visual regressions | Slot mapping not updated | Adjust `apps/explorer/src/styles/layers.css` |

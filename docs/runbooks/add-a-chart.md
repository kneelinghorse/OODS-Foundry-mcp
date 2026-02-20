# Runbook: Add a Chart

## Intent
- A normalized viz spec renders in Storybook with narrative + table fallback.
- Chart uses renderer selection and passes viz test filters.

## Files You Will Touch
- examples/viz/<chart-name>.spec.json - normalized spec fixture
- src/components/viz/<Chart>.tsx (optional) - new chart component wrapper
- stories/viz/<Chart>.stories.tsx - Storybook surface for the chart
- src/viz/adapters/* (optional) - only when adding a new renderer path

## Commands to Run
```bash
pnpm viz:suggest "1Q+2N goal=comparison" --layout --interactions --scaffold
pnpm test --filter=viz
pnpm storybook
```

## Expected Artifacts
- New or updated spec under `examples/viz/` with `a11y` fields filled
- Story renders the chart with the expected renderer and fallbacks

## Common Failure Modes
| Symptom | Cause | Fix |
| --- | --- | --- |
| Ajv validation error | Spec does not match normalized schema | Compare against `examples/viz/*.spec.json` and re-validate |
| Missing narration/table | `spec.a11y` fields omitted | Add `description`, `narrative`, and `tableFallback` |
| RendererSelectionError | `availableRenderers` is wrong or empty | Ensure renderer pool includes `vega-lite` or `echarts` |
| Story shows blank chart | Spec uses unknown trait IDs | Use canonical trait names from `docs/viz/normalized-viz-spec.md` |

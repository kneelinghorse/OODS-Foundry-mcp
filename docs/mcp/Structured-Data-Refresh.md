# Structured Data Refresh

`cmos/scripts/refresh_structured_data.py` regenerates the structured data exports consumed by MCP tools, Design Lab hints, and planning reports.

## Outputs

Defaults are written to `cmos/planning/`:
- `oods-components.json` — components, traits, objects, domains, patterns, sample queries, and stats.
- `oods-tokens.json` — token registry snapshot with component/system counts and trait overlay maps.
- `structured-data-delta-YYYY-MM-DD.md` — delta report versus the selected baseline (skipped with `--skip-delta`).

When `--artifact-dir <dir>` is supplied, versioned copies are emitted there plus `manifest.json` containing source paths, sizes, and ETags (version tag defaults to the run date or `--version-tag`).

## Baseline & delta rules

- Baseline resolution order: explicit path → current planning output → `cmos/research/` legacy files → freshly generated payloads.
- Delta covers added/removed components, traits, objects, token stats (reference/system/component/view maps), and sample query counts.

## Usage

```bash
python cmos/scripts/refresh_structured_data.py \
  --artifact-dir artifacts/structured-data \
  --version-tag 2025-11-25
```

Flags:
- `--output-dir` (defaults to `cmos/planning`)
- `--baseline-components`, `--baseline-tokens` (override baseline sources)
- `--generated-at` (pin timestamp for reproducible hashes; tests pin `2025-11-22T01:09:14Z`)
- `--skip-delta` (omit delta report)

## Notes

- Payloads are validated against `cmos/planning/component-schema.json`; the script aborts on schema errors.
- ETags are computed from canonical payloads with `generatedAt` removed; hashes stay stable for identical content (tests assert the component/token hashes).
- Trait/object discovery walks `traits/**/*.trait.yaml`, `domains/*/traits/*.trait.yaml`, and object definitions; patterns and sample queries are derived from the current registries.

# Structured Data Refresh

Primary entrypoint: `pnpm refresh:data`.

This wraps `cmos/scripts/refresh_structured_data.py` to regenerate structured data exports consumed by MCP tools, Design Lab hints, and planning reports.

`pnpm refresh:data` checks for Python 3 availability, applies sensible defaults, and forwards any additional flags to the underlying Python script.

## Usage (recommended)

```bash
pnpm refresh:data
```

To populate code snippets for primitives (Button, Card, Stack, Text, etc.) from the upstream design system repo, point the refresh at upstream Storybook stories:

```bash
pnpm refresh:data -- --upstream-root ../OODS-Foundry
```

Passthrough flags work (note the `--`):

```bash
pnpm refresh:data -- --skip-delta
```

Override defaults as needed:

```bash
pnpm refresh:data -- --artifact-dir artifacts/structured-data --version-tag 2026-02-24
```

## Outputs

Defaults are written to `cmos/planning/`:
- `oods-components.json` — components, traits, objects, domains, patterns, sample queries, and stats.
- `oods-tokens.json` — token registry snapshot with component/system counts and trait overlay maps.
- `structured-data-delta-YYYY-MM-DD.md` — delta report versus the selected baseline (skipped with `--skip-delta`).

When an upstream stories directory is configured, `pnpm refresh:data` also writes:
- `artifacts/structured-data/code-connect.json` — per-component usage snippets extracted from upstream Storybook stories (consumed by `catalog.list`).

When `--artifact-dir <dir>` is supplied, versioned copies are emitted there plus `manifest.json` containing source paths, sizes, and ETags.

Defaults used by `pnpm refresh:data`:
- `--artifact-dir artifacts/structured-data`
- `--version-tag auto` (uses `YYYY-MM-DD` from `generatedAt`)

Upstream stories resolution order:
- `--upstream-stories-dir <path>` (explicit stories directory)
- `--upstream-root <path>` (repo root; uses `<path>/stories`)
- `OODS_FOUNDRY_STORIES_DIR` / `OODS_FOUNDRY_ROOT` env vars
- sibling checkout `../OODS-Foundry/stories` (two-repo model)

## Baseline & delta rules

- Baseline resolution order: explicit path → current planning output → `cmos/research/` legacy files → freshly generated payloads.
- Delta covers added/removed components, traits, objects, token stats (reference/system/component/view maps), and sample query counts.

## Usage

```bash
python3 cmos/scripts/refresh_structured_data.py --artifact-dir artifacts/structured-data --version-tag 2025-11-25
```

Flags:
- `--output-dir` (defaults to `cmos/planning`)
- `--baseline-components`, `--baseline-tokens` (override baseline sources)
- `--generated-at` (pin timestamp for reproducible hashes; tests pin `2026-02-24T05:09:44Z`)
- `--skip-delta` (omit delta report)
- `--upstream-root`, `--upstream-stories-dir` (populate `code-connect.json` from upstream stories)

## Notes

- Payloads are validated against `cmos/planning/component-schema.json`; the script aborts on schema errors.
- Viz-related components include `renderComplexity` metadata (tier + score) derived from trait categories when applicable.
- ETags are computed from canonical payloads with `generatedAt` removed; hashes stay stable for identical content (tests assert the component/token hashes).
- Trait/object discovery walks `traits/**/*.trait.yaml`, `domains/*/traits/*.trait.yaml`, and object definitions; patterns and sample queries are derived from the current registries.

## CI automation (GitHub Actions)

Template workflow: `.github/workflows/refresh-structured-data.yml`.

It checks out the upstream design system repo, runs `pnpm refresh:data` with a stable `generatedAt` for the chosen `version_tag`, and opens a PR (with the delta report in the body) only when the manifest ETags change.

Triggers:
- `workflow_dispatch` (manual, always available)
- `repository_dispatch` (type: `oods-foundry-release`)

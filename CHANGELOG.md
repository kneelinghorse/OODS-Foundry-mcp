# Changelog

All notable changes to OODS Foundry MCP are documented here. This project uses sprint-based development. Each entry summarizes the sprint's key deliverables.

## Sprint 52 — Mapping, Onboarding & Versioned Data

- **map.create / map.list / map.resolve** — Three MCP tools for mapping external components to OODS traits. JSON Schema (Draft 2020-12) with 4 coercion strategies. Seed file with Material UI mappings.
- **Versioned structuredData.fetch** — `version` (YYYY-MM-DD) and `listVersions` parameters. Exact + nearest-available resolution with warnings. Backward compatible.
- 47 new tests (mapping contracts, versioning contracts, bridge E2E). 572 total tests.

## Sprint 51 — Composition Tool v1 (design.compose)

- **design.compose** — Template-based composition tool. 4 layout templates (dashboard, form, detail, list). Deterministic component selection engine with 13 intent mappings and 7 scoring dimensions.
- Intent parsing, layout auto-detection, slot filling, auto-validation pipeline.
- 44 integration contract tests. 525+ tests across the MCP server.

## Sprint 50 — Code Export (code.generate)

- **code.generate** — Validated UiSchema to framework-specific code. React/TSX and Vue SFC emitters. Leverages catalog metadata (propSchema, slots) and Code Connect infrastructure.
- HTML emitter for standalone output. Styling options: inline styles or design-token CSS variables.

## Sprint 49 — A11y in the Validation Loop

- **Token-to-color resolution** — `tokenColorResolver` resolves DTCG alias chains (sys -> theme -> ref -> hex).
- **repl.validate** — `checkA11y` flag runs 18 WCAG contrast rules alongside structural validation. Failures surfaced as `A11Y_CONTRAST` warnings with ratio, level, and fix hints.
- **a11y.scan** — Upgraded from placeholder to full implementation. Structured contrast report with per-rule results and aggregate summary.
- 20 contract tests, 3 E2E bridge tests.

## Sprint 48 — Pipeline Hardening & Test Coverage

- **XSS audit** — 2 vulnerabilities fixed in `tree-renderer.ts`. Shared `escapeHtml()` utility. 51 XSS test vectors.
- **Fragment mode edge cases** — 48 tests for deeply nested trees, empty/null children, mixed valid/invalid nodes.
- **Composition error enrichment** — `traitPath` and `impactedTraits` fields added to validation issues.
- 62 new contract tests expanding boundary and renderer coverage.

## Sprint 47 — Registry Gap Fixes & Workbench Unblock

- **Per-node error isolation** — `UNKNOWN_COMPONENT` errors no longer block entire render in non-strict fragment mode.
- **Grid component** — 84th registry component with CSS Grid layout support.
- Workbench S44 fixture (11 components) verified end-to-end through the MCP bridge.

## Sprint 46 — Fragment Render API

- **Fragment output mode** for `repl.render` — per-component HTML fragments instead of monolithic documents.
- Per-component CSS extraction with `cssRefs`. Output format discriminator (backward-compatible).
- Error isolation and strict mode. 8 technical missions delivered.

## Sprint 45 — Full Component Renderer Coverage

- HTML renderers for all 73 registry components + 10 basic components added to registry.
- End-to-end verification with Synthesis Workbench and Stage1 payloads.

## Sprint 44 — HTML Render & Bridge Unblock

- **repl.render** — Real HTML rendering with `html` field in output. Self-contained documents with inlined token CSS.
- Bridge `apply` mode and `structuredData.fetch` unblocked. Component mapper, tree walker, layout resolver.

## Sprint 43 — Refresh Pipeline & Adopter Experience

- Structured data refresh pipeline with npm entry points.
- Automated code snippet generation from upstream Storybook stories.
- CI templates for adopters.

## v0.1.0 — 2025-10-21

### Features
- Scaffolded internal packaging pipeline with provenance metadata, Storybook compatibility, and sample app smoke tests (mission B16.5).

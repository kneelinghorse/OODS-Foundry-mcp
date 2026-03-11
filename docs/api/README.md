# OODS Foundry API Reference

Auto-generated from JSON schemas and tool-descriptions.json.

## Auto-registered Tools

| Tool | Description |
|------|-------------|
| [tokens.build](./tokens-build.md) | Build design tokens for a brand and theme. Returns compiled CSS variables and token artifacts. Use apply=true to write output files (default: dry-run, returns preview only). |
| [structuredData.fetch](./structuredData-fetch.md) | Fetch structured data exports (components, tokens, or manifest). Supports ETag caching, version pinning, and version listing. |
| [repl.validate](./repl-validate.md) | Validate a UiSchema tree or patch against the Design Lab schema. Accepts schemaRef from design.compose. Returns validation errors, warnings, and optionally a normalized tree. |
| [repl.render](./repl-render.md) | Render a validated UiSchema into HTML/CSS preview output. Accepts schemaRef from design.compose. Supports document and fragment formats; HTML/fragments are returned only when apply=true (apply=false returns metadata-only preview). Use output.compact=true to omit token CSS (~40% size reduction) and receive a tokenCssRef instead. Note: schemaRef expires after 30 minutes — use schema.save to persist. |
| [brand.apply](./brand-apply.md) | Apply brand token overlays using alias or RFC 6902 patch strategy. Requires a delta object. Use apply=true to write changes to disk (default: dry-run, returns preview only). |
| [catalog.list](./catalog-list.md) | List available OODS components from the design system catalog. Filter by category, trait, or rendering context. Response includes availableCategories array showing all valid category values for filtering. |
| [code.generate](./code-generate.md) | Generate framework-specific code (React, Vue, or HTML) from a validated UiSchema tree. Accepts schemaRef from design.compose. Supports TypeScript and token-based styling. Note: schemaRef expires after 30 minutes — use schema.save to persist. |
| [design.compose](./design-compose.md) | Compose a complete UiSchema from a natural-language intent description. Returns schemaRef for reuse in validate/render/code.generate. schemaRef includes createdAt/expiresAt timestamps (default TTL: 30 minutes). Use schema.save to persist beyond TTL. |
| [pipeline](./pipeline.md) | Execute the full design pipeline (compose -> validate -> render -> codegen) in a single call. Defaults to compact render mode (token CSS omitted, ~40% smaller). Supports optional validation/render skipping, accessibility checks, and schema persistence via save parameter. Returns schemaRefCreatedAt/schemaRefExpiresAt (default TTL: 30 minutes). Use save to persist the schema. |
| [health](./health.md) | Check MCP server readiness and subsystem status, including registry counts, token artifact availability, and schema store state. |
| [map.create](./map-create.md) | Create a component-to-trait mapping between an external design system and OODS. Parameters: externalSystem, externalComponent, oodsTraits, propMappings, confidence, metadata (object with optional author and notes fields). Use apply=true to persist (default: dry-run, returns preview only). |
| [map.list](./map-list.md) | List all component-to-trait mappings. Optionally filter by external design system name. |
| [map.resolve](./map-resolve.md) | Resolve an external component to its OODS trait mapping with property translations. |
| [map.update](./map-update.md) | Update an existing component-to-trait mapping by ID. Supports changing traits, property mappings, confidence, and notes. |
| [map.delete](./map-delete.md) | Delete a component-to-trait mapping by ID. |
| [schema.delete](./schema-delete.md) | Delete a saved schema by name and remove it from schema index metadata. |
| [schema.list](./schema-list.md) | List saved schema metadata from the schema index. Supports object/context/tag filters. |
| [schema.load](./schema-load.md) | Load a previously saved schema by name and return a reusable schemaRef plus schema metadata for validate/render/code generation. |
| [schema.save](./schema-save.md) | Persist a composed UiSchema by name from schemaRef. Stores schema metadata (name, version, object/context, tags, timestamps) for reuse across sessions. Use this to persist schemas beyond the 30-minute schemaRef TTL. |
| [object.list](./object-list.md) | List OODS objects from the registry with optional filtering by domain, maturity, or trait. |
| [object.show](./object-show.md) | Show a full OODS object definition, including composed trait schema and view extensions. |
| [viz.compose](./viz-compose.md) | Compose a visualization schema from chart type, data bindings, and/or object viz traits. Returns schemaRef for pipeline reuse. schemaRef includes createdAt/expiresAt (default TTL: 30 minutes). Supports bar, line, area, and point chart types with axis, color, and size encodings. |

## On-demand Tools

| Tool | Description |
|------|-------------|
| [diag.snapshot](./diag-snapshot.md) | Capture a diagnostic snapshot bundle of the current design system state for debugging and reproducibility. |
| [reviewKit.create](./reviewKit-create.md) | Create a review kit artifact bundle for design review workflows. |
| [billing.reviewKit](./billing-reviewKit.md) | Generate a billing review kit comparing provider fixtures (Stripe, Chargebee) for a billing object. |
| [billing.switchFixtures](./billing-switchFixtures.md) | Switch the active billing fixture provider for Storybook scenarios. Use apply=true to record the switch (default: dry-run). |
| [a11y.scan](./a11y-scan.md) | Run WCAG accessibility contrast checks against design tokens. Optionally include a UiSchema for component inventory. |
| [purity.audit](./purity-audit.md) | Audit design token purity and detect style drift or non-standard overrides. |
| [vrt.run](./vrt-run.md) | Run visual regression tests against the current component state. |
| [release.verify](./release-verify.md) | Verify release readiness for specified packages. Checks changelogs, versions, and build artifacts. |
| [release.tag](./release-tag.md) | Create a release tag in the repository. Requires a tag name; optionally include a message. |

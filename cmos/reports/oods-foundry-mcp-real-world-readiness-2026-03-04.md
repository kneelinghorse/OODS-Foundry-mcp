# OODS Foundry MCP — Real‑World Readiness (Post‑Fix)
**Date:** 2026-03-04
**Author:** Codex (GPT-5)
**Assumption:** The previously reported defects are fixed (token build stub, align mapping, componentOverrides, intent selection gaps, a11y inconsistencies, etc.).

---

**Executive Summary**
With the current UX and correctness issues resolved, the remaining gap is not primarily polish — it is *product completeness*. To be production‑ready for real work, the MCP must expose the OODS object system, bind data to components deterministically, persist schemas across sessions, and generate code that is immediately usable in an application workflow (typed props, runtime bindings, and predictable styling). The tool should also provide stable, repeatable outputs with clear operational controls (versioning, persistence, and CI‑style validation).

---

**Production‑Readiness Requirements (Must‑Have)**

1. **Object System Integration**
Expose the object layer as first‑class MCP tools.
- `object_list` and `object_show` should return object definitions, traits, view extensions, and semantic mappings.
- `design_compose` must accept `object` + `context` and automatically place trait‑driven components into schema slots.
- Object semantic tokens must be applied during render and codegen.

2. **Deterministic Data Binding**
Generated UI must be wired to real data, not empty shells.
- Use object field schema + component propSchema to populate props by default.
- Emit a data adapter layer (input shape → component props) with clear field mappings.
- Fail clearly when a required field is missing.

3. **Schema Persistence + Versioning**
Real teams need durable schemas.
- `schema_save`, `schema_load`, `schema_list`, and `schema_delete` are required.
- Schemas must carry metadata (object, context, version, author, createdAt, tags).
- Support diffing between schema versions.

4. **Codegen Ready for Application Use**
Generated code should be usable without a full manual rewrite.
- Typed props derived from object schemas.
- Event handler stubs for forms, lists, and actions.
- Optional class‑based styling output (Tailwind or token‑class mapping) to support interactive states.

5. **Stable, Repeatable Outputs**
Results should be reproducible for CI and collaboration.
- Stable ordering of nodes and props.
- Seeded selection (or disabled randomness) for repeatability.
- Explicit versioning of the design registry and token sources in all outputs.

6. **End‑to‑End Orchestration**
A “one‑shot” flow for production scaffolding.
- A single orchestration command that performs compose → validate → render → codegen.
- Configurable flags for validations and output targets.

---

**Near‑Term Enhancements (Strongly Recommended)**

1. **Trait‑Level Coverage Metrics**
- A report showing which traits are present, which components were instantiated, and which view extensions were skipped.

2. **Component Inventory Quality Gates**
- Automated checks for duplicate traits, missing regions, and incomplete propSchemas.
- CI block if metadata integrity falls below a threshold.

3. **A11y + Compliance Gate**
- A single source of truth for contrast and a11y checks, with a pass/fail summary.
- A flag to fail codegen if a11y checks fail.

4. **Diff‑First Apply**
- All apply operations should produce a diff summary and artifacts, with a consistent preview format.
- Avoid silent writes when `apply=false`.

5. **API Compatibility Contracts**
- Clear contracts for framework outputs (React/Vue/HTML), and explicit differences.
- Versioned output schemas for tool consumers.

---

**Operational Readiness (Required for Real Work)**

1. **Reliability + Error Handling**
- Consistent error codes and hints across tools.
- Structured error payloads for automatic retries.

2. **CI Integration**
- A non‑interactive CLI or job runner to execute compose → validate → render → codegen in pipelines.
- Deterministic artifacts with checksums.

3. **Permission + Role Clarity**
- If tools are role‑gated, the permission model must be documented and surfaced clearly to callers.

4. **Performance Controls**
- Support for fragment rendering and CSS exclusion to keep output size manageable.
- Optional streaming or paged results for large catalogs.

---

**What “Production‑Ready” Looks Like**
A real team should be able to:
1. Select an object and context and get a fully composed UI with domain components.
2. Generate code that is immediately wired to data fields and typed.
3. Save that schema and return to it later with a durable ID.
4. Run validations and gate merges based on a11y and metadata checks.
5. Integrate the output into an app without rewriting structural code.

---

**Acceptance Checklist (Suggested)**
- `design_compose(object, context)` renders correct trait‑driven components.
- Generated code has non‑empty props populated from object schema.
- `schema_save` and `schema_load` persist layouts across sessions.
- `code_generate(styling="tailwind")` outputs class‑based styles.
- All outputs include registry and token version metadata.
- End‑to‑end orchestration succeeds in ≤3 tool calls.

---

**Bottom Line**
Once the earlier defects are fixed, the main blocker to real‑world readiness is *missing product surface area* — object integration, persistence, and binding. If those are built, the MCP becomes a credible production scaffolding engine rather than a purely structural mockup tool.

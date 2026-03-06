## Recommendations

1. **Fix pipeline.save schema** to accept `string | { name: string, tags: string[] }` union type
2. **Align map.resolve** response status to `"found"` / `"not_found"` per documentation
3. **Align map.delete** response to `{ deleted: true }` per documentation
4. **Update test script** 8.1 propMappings to use the array-of-objects format matching the actual API
5. **Consider** adding `options.typescript` and `options.framework` testing to pipeline phase

---

## Release Readiness Assessment

### Current State: Ready for Public Beta (0.x)

The core value proposition — natural-language intent to production-ready, trait-driven UI code — is real, differentiated, and working. The architecture is sound. What follows are the gaps between "working" and "standout open source project."

### Must-Fix Before Public Release

**1. Contract fidelity (trust)**
Open source developers will read docs, copy a payload, and expect it to work. The 3 contract mismatches found in this test (pipeline.save, map.resolve, map.delete) are small fixes but each one that ships becomes a GitHub issue, a Stack Overflow question, and an erosion of first-impression trust. These should be zero before any public announcement.

**2. Composition explainability**
The composition engine makes good choices, but developers can't see *why*. When a slot gets `confidence: 0.29` and picks `GeoFieldMappingForm`, the reasoning (`"tag match (map); 1 trait(s); name contains \"map\""`) is present but buried. For open source adoption:
- Surface a human-readable composition rationale per slot (not just scoring factors)
- Make low-confidence selections visually distinct in rendered output (e.g., `data-oods-confidence="low"`)
- Document the ranking algorithm at a conceptual level so users can predict and influence it

**3. Override and escape hatches**
The `preferences.componentOverrides` exists but wasn't exercised in this test. For open source credibility, the override story needs to be front-and-center:
- "Don't like what we picked? Here's how to swap it in one line"
- Allow per-slot component pinning in pipeline calls
- Support a `.oodsrc` or similar project-level defaults file

### Should-Fix for Standout Quality

**4. Interactive playground / REPL**
The `repl.render` with `apply: true` produces beautiful HTML. Ship a hosted playground where users can type an intent and see the result live. This is the single highest-leverage thing for adoption — people need to *feel* the magic before they read the docs. The compact render mode (tokenCssRef) already optimizes for this.

**5. First-run experience**
The `health` endpoint returns registry counts but nothing guides a new user. Add an `onboard` or `quickstart` tool that:
- Suggests a first compose call based on detected project context
- Returns a working copy-paste example for their framework (React/Vue/HTML)
- Links to the 3 most relevant objects for their domain

**6. Schema versioning and migration**
`schema.save` creates versioned schemas (version: 1, 2, ...) but there's no `schema.diff` or migration story. When the DSL or component registry evolves, saved schemas may break silently. Add:
- `schema.validate` against current registry (flag stale component references)
- `schema.migrate` to update saved schemas to current DSL version
- Version pinning in `schema.load` so old schemas render predictably

**7. Error recovery, not just error reporting**
Errors are well-structured (OODS-S004, OODS-N003) with hints. Take it further:
- On `OODS-S004` (unknown object), suggest the closest match via fuzzy matching (e.g., "Did you mean 'Transaction'?")
- On expired schemaRef, auto-suggest the `schema.load` call if a saved version exists
- Return a `recovery` object with a ready-to-execute payload that fixes the issue

**8. Token/brand customization showcase**
`tokens.build` and `brand.apply` exist but weren't part of the test script. For open source, theming is a major draw. Ship:
- 2-3 built-in brand presets (not just Brand A) so users see the token system in action immediately
- A `pipeline` option for `theme: "dark"` that works end-to-end
- Before/after render comparisons in docs showing the same compose output under different brands

### Differentiators to Lean Into

These are things the platform already does well that most competitors don't. They should be prominent in README, docs, and marketing:

**9. Trait-driven composition is unique**
No other MCP design tool maps domain objects through behavioral traits to component selection. The fact that a `Product` with `financial/Priceable` automatically gets `PriceSummary` and `PriceBadge` — and that adding a new trait to an object changes the composed UI — is a genuinely novel architecture. This needs a dedicated "How It Works" page with a visual diagram.

**10. Multi-framework code generation from a single schema**
Compose once, generate React + Vue + HTML. This is a real workflow accelerator. Lean into it:
- Show the same schemaRef generating all 3 frameworks side-by-side
- Add framework comparison metrics (bundle size estimate, component count)
- Consider adding Svelte and Solid as additional targets — the architecture clearly supports it

**11. Visualization composition**
`viz.compose` with auto-detected encodings from object fields is impressive. A `Transaction` automatically gets `created_at` on x-axis and `unit_amount_cents` on y-axis because the engine understands temporal and numeric semantics. This should be a headline feature, not buried in Phase 7.

**12. The object registry itself**
11 well-modeled domain objects (User, Product, Transaction, Subscription, Invoice, Organization, etc.) covering identity, commerce, billing, and content domains. This is a head start that most design systems don't offer. Position it as "bring your domain model, or start with ours."

### Competitive Positioning

| Capability | OODS Foundry | Vercel v0 | Figma Dev Mode | Plasmic |
|---|---|---|---|---|
| Intent-to-code | Yes (trait-aware) | Yes (visual) | No | No |
| Domain object binding | Yes (11 objects) | No | No | No |
| Multi-framework output | React/Vue/HTML | React only | CSS only | React only |
| Design token system | Built-in | None | Partial | Partial |
| MCP native | Yes | No | No | No |
| Visualization | Yes (4 chart types) | No | No | No |
| External system mapping | Yes | No | No | No |

### Summary

The platform is architecturally sound and functionally complete. The gap to "standout open source" is mostly about developer experience polish: contract fidelity, explainability, escape hatches, and a playground that lets people feel the value in 30 seconds. The underlying differentiators (trait composition, multi-framework codegen, domain objects, viz) are genuine and hard to replicate. Ship the beta, fix the contracts, build the playground, and tell the trait-composition story loudly.
# OODS Foundry MCP - E2E Retest Report (Sprint 71-73)

**Date:** 2026-03-05
**Tester:** Claude Opus 4.6 (retest after Sprint 71-73 upgrades)
**Test Script:** `oods-mcp-e2e-test-script.md`
**Server Version:** 0.1.0 (freshly restarted with Sprint 71-73 dist)
**DSL:** 1.0 with 2026.02 payloads
**Previous Reports:** Claude original (pre-upgrade), Codex GPT-5 (pre-upgrade)

---

## Executive Summary

Sprint 71-73 addressed 5 of the 11 original issues. The composition intelligence upgrades (slot expansion, field affinity, position affinity) are live and measurable. Compact mode eliminates the payload size blocker. `map.create` is now exposed. The schema save object metadata bug is fixed. However, the core composition quality gap remains: slots are still filled with keyword-matched components rather than semantically appropriate ones, and generated code still doesn't bind props.

---

## Completion Scorecard

| Phase | Tasks | Completed | Failed | Notes |
|---|---:|---:|---:|---|
| 1. Discovery | 3 | 3 | 0 | `availableCategories` now returned in catalog.list |
| 2. Composition | 3 | 3 | 0 | Slot expansion active; position/field affinity active |
| 3. Validation/Render | 2 | 2 | 0 | Script payloads work (mode: "full" still required) |
| 4. Code Generation | 3 | 3 | 0 | Props still not bound in JSX/template |
| 5. Pipeline | 2 | 2 | 0 | Compact mode working; save works |
| 6. Schema Persistence | 3 | 3 | 0 | Object metadata bug FIXED |
| 7. Visualization | 2 | 2 | 0 | Object auto-binding still empty |
| 8. Mappings | 3 | 3 | 0 | `map.create` NOW EXPOSED and working |
| 9. Edge Cases | 4 | 4 | 0 | Low-confidence layout warning is new and helpful |
| **Total** | **25** | **25** | **0** | First clean 25/25 run |

---

## Sprint 71-73 Regression: What Changed

### Fixed (5 issues resolved)

| # | Original Issue | Status | Evidence |
|---|---|---|---|
| 1 | `map.create` not exposed (Phase 8 blocked) | **FIXED** | Created `material-ui-mui-data-grid` with `apply: true`, resolved, deleted successfully. Full CRUD works. |
| 4 | No discoverability for categories | **PARTIALLY FIXED** | `catalog.list` now returns `availableCategories` array (13 categories including viz.*). Object domains and trait enums still undiscoverable. |
| 5 | Schema save object metadata bug | **FIXED** | Saved Transaction schema, loaded it back: `object: "Transaction"` (was "Archive" before). |
| 7 | Response payload sizes (87-102K) | **FIXED** | Pipeline compact mode active: `<!-- tokens.css omitted (compact mode) -->`. Pipeline response ~14K bytes vs previous ~96K. ~85% reduction. |
| 10 | Intent-aware slot generation | **PARTIALLY FIXED** | Slot expander activated: Product detail expanded from 3 to 8 tabs for 38 fields. But dashboard layout still produces fixed 4 slots regardless of intent complexity. |

### New Sprint 73 Features Confirmed

| Feature | Evidence | Impact |
|---|---|---|
| Slot Expander | `meta.intelligence.slotsExpanded: 5`, "Expanded from 3 to 8 tabs for 38 fields" | Detail views now scale with field count |
| Field Affinity | `meta.intelligence.fieldAffinityUsed: true`, differentiated confidence scores | Component selection considers field types |
| Position Affinity | `meta.intelligence.positionAffinityUsed: true`, "PaginationBar fits well in footer" | Components scored by slot position |
| Slot Patterns | `meta.intelligence.patternsApplied: 3` (on long-intent compose) | Composite slot patterns generated |
| Low-confidence warning | `OODS-V116`: "Layout auto-detection confidence is low (0.38)" | Users warned when layout inference is uncertain |

### Not Fixed (6 issues remain)

| # | Original Issue | Current Status | Notes |
|---|---|---|---|
| 1 | Test script doesn't match API | **Not fixed** | `repl.validate` still needs `mode: "full"`, `viz.compose` still needs `dataBindings` not `data`, pipeline `options` shape still wrong |
| 2 | SchemaRef 30-min TTL undocumented | **Not fixed** | TTL visible in responses but no docs, no auto-extend |
| 3 | `apply` pattern inconsistent | **Not fixed** | `map.create` uses `apply` for persistence, `repl.render` for output inclusion, same ambiguity |
| 6 | Props not bound in generated code | **Not fixed** | React: `{classificationMetadata}` referenced without destructuring. `fieldsBound: 1` in pipeline. Vue same pattern. |
| 8 | Viz object auto-binding empty | **Not fixed** | Transaction line chart: `traitsResolved: []`, `encodingsApplied: []` |
| 9 | Pipeline save doesn't support tags | **Not fixed** | `save` only accepts string, saved schema has `tags: []` |

---

## Detailed Task Comparison (3-way: Claude Original vs Codex vs Claude Retest)

### Phase 2.1 — Product Detail Compose

| Dimension | Claude Original (pre-upgrade) | Codex (pre-upgrade) | Claude Retest (Sprint 73) |
|---|---|---|---|
| Tab count | 3 | 8 | **8** (expanded from 3) |
| Slot count | 5 | 10 | **10** |
| Node count | 13 | 23 | **23** |
| `meta.intelligence` | absent | absent | **present**: `fieldsExpanded: true, slotsExpanded: 5, positionAffinityUsed: true, fieldAffinityUsed: true` |
| Header binding | `classification_metadata` | `classification_metadata` | `classification_metadata` (unchanged) |
| Tab content | Badge/Badge/Card | Badge (repeated) | Badge (repeated in all 8 tabs) |
| View ext candidates | flat 0.95 confidence | flat 0.95 confidence | **still flat 0.95** for view_ext, but keyword slots now differentiated |

**Assessment:** Slot expansion works mechanically (3→8 tabs), but tab content is worse — 8 identical Badge components instead of 3. More slots without better filling = more empty scaffolding.

### Phase 2.2 — User List Compose

| Dimension | Claude Original | Codex | Claude Retest |
|---|---|---|---|
| Pagination component | Text (wrong) | Text (wrong) | **PaginationBar** (correct in selections) |
| Position affinity | absent | absent | **present**: "PaginationBar fits well in footer" |
| Search component | Input | Input | Input (SearchInput ranked 3rd at 0.61) |
| Filter component | Select | Select | **SearchInput** (ranked 1st at 1.0 for filter-control) |

**Assessment:** Position affinity is a real improvement — PaginationBar correctly identified for footer. But the schema tree still renders `Text` for pagination even though selections say PaginationBar. The selection→tree gap persists.

### Phase 5.1 — Pipeline

| Dimension | Claude Original | Codex | Claude Retest |
|---|---|---|---|
| Response size | ~96K chars | ~96K chars | **~14K chars** (compact mode) |
| Token CSS | Full 80K inline | Full inline | **Omitted**: `<!-- tokens.css omitted (compact mode) -->` |
| Duration | 12ms | 12ms | **6ms** |
| Steps | 4 | 4 | 4 |

**Assessment:** Compact mode is a major win. ~85% payload reduction makes pipeline genuinely MCP-friendly.

### Phase 8 — Mappings

| Dimension | Claude Original | Codex | Claude Retest |
|---|---|---|---|
| map.create | Not exposed | Not exposed | **WORKING** with `apply: true` |
| map.resolve | Not found | Not found | **WORKING** with prop translations |
| map.delete | N/A | N/A | **WORKING** |
| Trait validation | N/A | N/A | Warns on short trait names (`Searchable` → "Unknown trait") |

**Assessment:** Full CRUD now works. Trait name validation warns but doesn't block — good DX. Needs docs on expected format (`behavioral/Searchable` vs `Searchable`).

### Phase 9.4 — Long Intent

| Dimension | Claude Original | Codex | Claude Retest |
|---|---|---|---|
| Layout detected | dashboard | form (wrong) | **dashboard** (confidence 0.38) |
| Low-confidence warning | absent | absent | **OODS-V116**: "confidence is low (0.38)" |
| Slot count | 4 | varies | **4** (unchanged) |
| Dashboard context warning | absent | absent | **OODS-V119**: "No view_extensions for dashboard context" |

**Assessment:** Better diagnostics but same structural limitation. 500-word intent with 7 sections still produces 4 generic slots.

---

## Schema Quality Assessment (Retest)

| Compose Result | Component Selection | Layout Structure | Trait Integration | Slot Filling | Delta vs Original |
|---|---:|---:|---:|---:|---|
| Product detail (2.1) | 2/5 | 3/5 | 3/5 | 1/5 | Structure improved (8 tabs), filling worse (8 identical Badges) |
| User list (2.2) | 3/5 | 3/5 | 3/5 | 2/5 | PaginationBar correctly selected; search still Input not SearchInput |
| Settings form (2.3) | 2/5 | 3/5 | 2/5 | 2/5 | No change — all fields still PreferenceEditor |
| Long intent (9.4) | 2/5 | 2/5 | 2/5 | 1/5 | Better warnings, same 4-slot structure |

## Code Generation Quality (Retest)

| Codegen Result | Syntactic Correctness | Idiomatic Style | Token Usage | Completeness | Delta vs Original |
|---|---:|---:|---:|---:|---|
| React (4.1) | 3/5 | 3/5 | 4/5 | 2/5 | Same: props defined but not bound |
| Vue (4.2) | 4/5 | 3/5 | 4/5 | 2/5 | Tailwind classes present; template still empty slots |
| HTML (4.3) | 4/5 | 3/5 | 4/5 | 3/5 | 89K output (large but functional) |

---

## Updated Scoring

### MCP Platform Score: 68/100 (up from 62)

| Category | Weight | Score | Notes |
|---|---:|---:|---|
| API Surface Completeness | 15 | 13/15 | map.create now exposed; all 25 tasks pass |
| Composition Intelligence | 25 | 10/25 | Slot expansion + affinity are real but don't fix core quality gap |
| Code Generation Quality | 20 | 8/20 | Props interface excellent; binding still missing |
| Pipeline & Persistence | 15 | 13/15 | Compact mode, save, load all work well |
| Error Handling & DX | 10 | 9/10 | OODS-V116 low-confidence warning is excellent |
| Visualization | 10 | 3/10 | Still non-functional for object auto-binding |
| Documentation & Discoverability | 5 | 3/5 | availableCategories helps; test script still misaligned |

### Agent UX Score: 7.5/10 (up from 7.0)

- **Improved**: Compact mode makes pipeline responses manageable. map.create enables full test coverage. Better warnings save debugging time.
- **Same**: Contract mismatches still require trial-and-error. Prop binding gap means codegen output needs manual work.
- **New concern**: Slot expansion can make things worse (8 identical Badge tabs instead of 3) without better content differentiation.

---

## Updated V1 Release Gate Status

| Gate | Previous | Current | Evidence |
|---|---|---|---|
| Mapping CRUD executable from MCP | **Fail** | **Pass** | Full create→resolve→delete cycle works |
| E2E script copy/paste accurate | **Fail** | **Fail** | Still needs `mode: "full"` for repl.*, `dataBindings` for viz |
| Schema persistence metadata integrity | **Fail** | **Pass** | Transaction saves and loads correctly |
| Pipeline save supports tags | **Fail** | **Fail** | `save` still string-only, `tags: []` |
| Error messages actionable | **Pass** | **Pass** | Now includes OODS-V116 low-confidence warning |
| End-to-end compose→validate→render→codegen | **Pass** | **Pass** | 6ms pipeline with compact mode |

### Updated Go/No-Go

**Recommendation: Conditional Go for public v1.**

The P0 blockers from the original report are now 2/4 resolved (map.create, schema metadata). The remaining P0s are:
1. **Align test script with live API** — straightforward docs fix
2. **Pipeline tag support** — small API change

With those two fixes, the platform passes all release gates. The composition quality issues (slot filling, prop binding, viz auto-binding) are real but are quality-of-experience rather than correctness blockers. Ship with documented limitations.

---

## Recommendations for Sprint 74

### P0 (Ship blockers)
1. Fix test script contract mismatches (repl.* mode, pipeline options, viz dataBindings)
2. Add pipeline `save: { name, tags }` support (schema already accepts it per Sprint 72 input schema)

### P1 (Quality)
3. **Fix selection→tree disconnect**: Selections say PaginationBar but tree renders Text. The slot filler picks the right component but doesn't write it into the schema tree.
4. **Deduplicate expanded slots**: 8 tabs with identical Badge is worse than 3 tabs. Slot expander should distribute view_extension components across expanded slots.
5. **Bind props in codegen**: Even `{/* TODO: bind props.label */}` comments per slot would help.

### P2 (Polish)
6. Document trait name format for map.create (`behavioral/Searchable` vs `Searchable`)
7. Wire viz object auto-binding or mark as experimental in health
8. Add `compact` option to `repl.render` and `code.generate` (currently only pipeline)

---

## Final Verdict (Retest)

Sprint 71-73 delivered measurable infrastructure improvements: compact mode (~85% payload reduction), map.create CRUD, schema metadata fix, slot expansion, and affinity scoring. These are real fixes that address real feedback.

**The gap that remains is semantic**: the compositor knows *where* components should go (position affinity) and *what types* fit (field affinity), but still fills every expanded slot with the same keyword-matched component. The result is scaffolding that's structurally bigger but not meaningfully smarter.

For a public v1, this is shippable with documented limitations. The fix path is clear: connect the selection metadata (which is often correct) to the actual schema tree, and distribute view_extension components across expanded slots instead of repeating the top keyword match.

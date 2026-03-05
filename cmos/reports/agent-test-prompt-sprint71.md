# OODS Foundry MCP — Agent Test Prompt

> Give this prompt to Claude, GPT, Gemini, or any MCP-capable agent in a fresh session.
> The agent must have the `oods-foundry` MCP server connected.

---

## BEGIN PROMPT

You have access to the OODS Foundry MCP server — a design system composition engine. Your job is to complete the tasks below in order, record what happens at each step, and provide structured feedback at the end.

**Rules:**
- Complete each task in order. Do not skip tasks.
- Record the exact tool calls you make and their results (success/failure, key output fields).
- If something fails, note the error and try to recover. Do not stop — move to the next task.
- If something is confusing, unintuitive, or undocumented, note it.
- Time yourself roughly — note which tasks feel slow or require many attempts.

---

### Phase 1: Discovery (Orient yourself)

**Task 1.1 — Health check**
Call `health` with no arguments. Report: Is the server ready? What subsystems are listed? What component/trait/object counts do you see?

**Task 1.2 — Explore objects**
Call `object.list` with no arguments. How many objects are returned? Pick one that looks interesting and call `object.show` on it. What traits does it have? Is the output understandable?

**Task 1.3 — Explore the catalog**
Call `catalog.list` with no arguments. How many components are in the catalog? Try filtering by category (e.g., `category: "form"` or `category: "badge"`). Did filtering work as expected?

---

### Phase 2: Core Composition (The main workflow)

**Task 2.1 — Compose a detail view**
Call `design.compose` with:
```json
{
  "intent": "A detail view for a Product showing name, price, SKU, and inventory status with a status badge",
  "object": "Product"
}
```
Did you get a `schemaRef` back? Examine the UiSchema tree — does it make sense for the intent? Note any components that seem wrong or missing.

**Task 2.2 — Compose a list view**
Call `design.compose` with:
```json
{
  "intent": "A paginated list of Users showing name, email, and role with search and filtering",
  "object": "User"
}
```
Does the result include behavioral components (SearchInput, PaginationBar, FilterPanel)? Are they in the right positions (header/footer)?

**Task 2.3 — Compose with no object**
Call `design.compose` with:
```json
{
  "intent": "A settings page with a form for notification preferences: email toggle, SMS toggle, frequency dropdown"
}
```
Does it work without an `object` parameter? Is the result reasonable?

---

### Phase 3: Validation & Rendering

**Task 3.1 — Validate**
Take the `schemaRef` from Task 2.1 and call `repl.validate` with it:
```json
{
  "schemaRef": "<your-schemaRef-from-2.1>"
}
```
Does validation pass? Are there warnings? Is the output clear?

**Task 3.2 — Render to HTML**
Take the same `schemaRef` and call `repl.render`:
```json
{
  "schemaRef": "<your-schemaRef-from-2.1>",
  "apply": true
}
```
Did you get HTML back? Does it look like a reasonable Product detail view?

---

### Phase 4: Code Generation

**Task 4.1 — Generate React code**
Call `code.generate`:
```json
{
  "schemaRef": "<your-schemaRef-from-2.1>",
  "framework": "react",
  "options": { "typescript": true, "styling": "tokens" }
}
```
Is the generated React/TypeScript code usable? Are imports correct? Does it use design tokens?

**Task 4.2 — Generate Vue code**
Same schemaRef, but:
```json
{
  "framework": "vue",
  "options": { "typescript": true, "styling": "tailwind" }
}
```
Does it produce a valid Vue SFC? Does Tailwind styling look correct?

**Task 4.3 — Generate HTML**
Same schemaRef, but:
```json
{
  "framework": "html",
  "options": { "styling": "inline" }
}
```
Is the HTML self-contained? Could you paste it into a browser?

---

### Phase 5: Pipeline (End-to-end)

**Task 5.1 — Full pipeline**
Call `pipeline`:
```json
{
  "intent": "A dashboard card showing an Organization's plan tier, billing status, and member count",
  "object": "Organization",
  "framework": "react",
  "options": { "typescript": true, "styling": "tokens" }
}
```
Does it run compose → validate → render → codegen in one call? What does the response structure look like? Is it clear which phase produced which output?

**Task 5.2 — Pipeline with schema save**
Call `pipeline` again but add `save`:
```json
{
  "intent": "A transaction receipt showing amount, payment method, and status",
  "object": "Transaction",
  "framework": "react",
  "options": { "typescript": true, "styling": "tokens" },
  "save": { "name": "transaction-receipt-v1", "tags": ["receipt", "transaction"] }
}
```
Did the schema persist? Check with `schema.list` — is your saved schema there?

---

### Phase 6: Schema Persistence

**Task 6.1 — Load saved schema**
Call `schema.load` with the name from Task 5.2:
```json
{
  "name": "transaction-receipt-v1"
}
```
Did you get a `schemaRef` back? Can you use it in `code.generate` to produce Vue code?

**Task 6.2 — List and filter schemas**
Call `schema.list` with no arguments. Then try filtering:
```json
{
  "tags": ["receipt"]
}
```
Does tag filtering work?

**Task 6.3 — Delete schema**
Call `schema.delete`:
```json
{
  "name": "transaction-receipt-v1"
}
```
Confirm it's gone with `schema.list`. Clean deletion?

---

### Phase 7: Visualization

**Task 7.1 — Compose a bar chart**
Call `viz.compose`:
```json
{
  "chartType": "bar",
  "data": {
    "x": { "field": "category", "type": "nominal" },
    "y": { "field": "revenue", "type": "quantitative" }
  },
  "title": "Revenue by Category"
}
```
Does it return a visualization schema? Is the structure clear?

**Task 7.2 — Compose from object traits**
Call `viz.compose`:
```json
{
  "object": "Transaction",
  "chartType": "line"
}
```
Does it auto-bind data encodings from the Transaction object's viz traits? Or does it require manual bindings?

---

### Phase 8: Mappings

**Task 8.1 — Create a mapping**
Call `map.create`:
```json
{
  "externalSystem": "material-ui",
  "externalComponent": "MuiDataGrid",
  "traits": ["Searchable", "Filterable", "Pageable", "Sortable"],
  "propertyMappings": {
    "rows": "data",
    "columns": "fields",
    "pageSize": "defaultPageSize"
  },
  "confidence": 0.85,
  "notes": "MUI DataGrid maps to behavioral list traits"
}
```
Did it create successfully? What ID was returned?

**Task 8.2 — Resolve the mapping**
Call `map.resolve`:
```json
{
  "externalSystem": "material-ui",
  "externalComponent": "MuiDataGrid"
}
```
Does it return the mapping with property translations?

**Task 8.3 — Delete the mapping**
Clean up with `map.delete` using the ID from 8.1.

---

### Phase 9: Edge Cases & Error Handling

**Task 9.1 — Invalid object**
Call `design.compose` with `"object": "NonExistentThing"`. What error do you get? Is it helpful?

**Task 9.2 — Invalid schemaRef**
Call `repl.validate` with `"schemaRef": "bogus-ref-12345"`. What happens?

**Task 9.3 — Empty intent**
Call `design.compose` with `"intent": ""`. Does it error gracefully or produce garbage?

**Task 9.4 — Very long intent**
Call `design.compose` with a 500+ word intent description. Does it handle it? Is the result better or worse than a concise intent?

---

## Feedback Template

After completing all tasks, fill out this structured feedback:

### Completion Scorecard

| Phase | Tasks | Completed | Failed | Notes |
|---|---|---|---|---|
| 1. Discovery | 3 | | | |
| 2. Composition | 3 | | | |
| 3. Validation/Render | 2 | | | |
| 4. Code Generation | 3 | | | |
| 5. Pipeline | 2 | | | |
| 6. Schema Persistence | 3 | | | |
| 7. Visualization | 2 | | | |
| 8. Mappings | 3 | | | |
| 9. Edge Cases | 4 | | | |
| **Total** | **25** | | | |

### Top Issues (rank by severity)

1. **[BLOCKER/HIGH/MEDIUM/LOW]** — Description of the issue, which task it affected, exact error if applicable.
2. ...
3. ...

### Usability Observations

- **What was intuitive?** (List tools/workflows that "just worked")
- **What was confusing?** (List tools/workflows that required guessing or re-reading)
- **What was missing?** (Features you expected but couldn't find)
- **What surprised you?** (Behavior that was unexpected, good or bad)

### Schema Quality Assessment

For each `design.compose` result, rate 1-5:
- **Component selection** — Did it pick the right components? (1=wrong, 5=perfect)
- **Layout structure** — Is the hierarchy logical? (1=broken, 5=clean)
- **Trait integration** — Are object traits properly reflected? (1=ignored, 5=fully used)
- **Slot filling** — Are props/data bindings correct? (1=empty, 5=complete)

### Code Generation Quality

For each `code.generate` result, rate 1-5:
- **Syntactic correctness** — Would it compile/parse? (1=broken, 5=clean)
- **Idiomatic style** — Does it follow framework conventions? (1=odd, 5=native)
- **Token usage** — Are design tokens properly integrated? (1=hardcoded, 5=tokenized)
- **Completeness** — Is it a usable starting point? (1=stub, 5=production-ready)

### Final Verdict

In 2-3 sentences: Would you use this tool in a real design workflow? What's the single biggest thing holding it back?

---

## END PROMPT

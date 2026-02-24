# OODS Foundry MCP — Demo Showcase

**Date:** 2026-02-24
**For:** Conference demos, README walkthroughs, partner onboarding

---

## The Pitch (30 seconds)

OODS Foundry MCP gives AI agents a governed interface to a real design system. Instead of guessing at component names and hoping CSS works, agents can **discover** what exists, **validate** what they propose, and **theme** the result — all through structured MCP tool calls with audit trails.

---

## Demo Flow: "Agent Designs a Dashboard" (3-5 minutes)

### Step 1 — Discover: What do we have?

**Tool:** `catalog.list`

The agent asks the design system what's available. No guessing, no hallucinating component names.

```json
// Input
{ "category": "core" }

// Output (abbreviated)
{
  "components": [
    {
      "name": "StatusChip",
      "displayName": "Status Chip",
      "traits": ["Statusable", "Themeable"],
      "contexts": ["list", "detail", "timeline"],
      "propSchema": {
        "status": { "type": "string", "enum": ["active", "pending", "cancelled"] },
        "size": { "type": "string", "enum": ["sm", "md", "lg"] }
      },
      "codeReferences": [{
        "kind": "storybook",
        "path": "stories/traits/Statusable.stories.tsx",
        "snippet": "import { StatusChip } from '@oods/components';\n\n<StatusChip status=\"active\" size=\"md\" />"
      }],
      "codeSnippet": "import { StatusChip } from '@oods/components';\n\n<StatusChip status=\"active\" size=\"md\" />"
    }
  ],
  "totalCount": 73,
  "stats": { "componentCount": 73, "traitCount": 35 }
}
```

**The point:** The agent gets component names, prop schemas, trait capabilities, rendering contexts, AND real code snippets — everything needed to write correct code on the first try. This is our Code Connect equivalent.

---

### Step 2 — Validate: Is this UI schema legal?

**Tool:** `repl.validate`

The agent proposes a UI schema. The system checks it against the component registry and catches errors before anything renders.

```json
// Input
{
  "uiSchema": {
    "version": "1.0.0",
    "screens": [{
      "id": "account-dashboard",
      "component": "Stack",
      "children": [
        {
          "id": "header",
          "component": "PageHeader",
          "props": { "title": "Account Overview" }
        },
        {
          "id": "status",
          "component": "StatusChip",
          "props": { "status": "active" }
        },
        {
          "id": "actions",
          "component": "QuickActions",
          "props": {}
        }
      ]
    }]
  }
}

// Output
{
  "status": "invalid",
  "errors": [
    {
      "type": "UNKNOWN_COMPONENT",
      "component": "QuickActions",
      "message": "Component 'QuickActions' is not in the OODS registry. Did you mean 'ActionBar'?"
    }
  ],
  "meta": {
    "screenCount": 1,
    "nodeCount": 4,
    "validComponents": ["Stack", "PageHeader", "StatusChip"],
    "invalidComponents": ["QuickActions"]
  }
}
```

**The point:** The system has opinions. It tells the agent what's allowed and what isn't. No silent failures, no runtime surprises. The agent fixes `QuickActions` → `ActionBar` and re-validates.

---

### Step 3 — Render: Show me the result

**Tool:** `repl.render`

The corrected schema goes through the render pipeline. The system confirms the UI is structurally sound and render-ready.

```json
// Input (corrected schema)
{
  "uiSchema": {
    "version": "1.0.0",
    "screens": [{
      "id": "account-dashboard",
      "component": "Stack",
      "children": [
        { "id": "header", "component": "PageHeader", "props": { "title": "Account Overview" } },
        { "id": "status", "component": "StatusChip", "props": { "status": "active" } },
        { "id": "actions", "component": "ActionBar", "props": {} }
      ]
    }]
  }
}

// Output
{
  "status": "valid",
  "preview": {
    "screens": ["account-dashboard"],
    "routes": ["/account-dashboard"],
    "summary": "1 screen, 4 nodes, 0 errors"
  }
}
```

**The point:** Validated schemas produce render-ready output. The governance loop is closed.

---

### Step 4 — Theme: Apply a brand

**Tool:** `brand.apply`

Apply a brand token overlay. See the before/after diff, generated CSS custom properties, and diagnostics.

```json
// Input
{
  "brand": "client-a",
  "delta": {
    "color": {
      "primary": { "$value": "#1a73e8" },
      "surface": { "$value": "#f8f9fa" }
    },
    "borderRadius": {
      "md": { "$value": "12px" }
    }
  },
  "apply": true
}

// Output
{
  "status": "applied",
  "diffs": {
    "base": { "changed": 3, "added": 0, "removed": 0 },
    "dark": { "changed": 2, "added": 0, "removed": 0 }
  },
  "artifacts": [
    { "name": "variables.css", "size": 2048 },
    { "name": "specimens.json", "size": 512 }
  ],
  "diagnostics": {
    "contrastWarnings": 0,
    "tokenCoverage": "98%"
  }
}
```

**The point:** Theming is a governed operation with audit trails and contrast checks — not a find-and-replace on hex codes.

---

## The Governance Loop (Summary Slide)

```
  Discover          Validate          Render           Theme
 ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
 │ What      │     │ Is this  │     │ Show me  │     │ Apply    │
 │ exists?   │ ──▶ │ legal?   │ ──▶ │ the      │ ──▶ │ a brand  │
 │           │     │          │     │ result   │     │          │
 └──────────┘     └──────────┘     └──────────┘     └──────────┘
  catalog.list     repl.validate    repl.render      brand.apply
  73 components    Schema check     Render preview   Token overlay
  35 traits        Error feedback   Route mapping    CSS generation
  Code snippets    Suggestions      Structure meta   Contrast audit
```

Each step produces structured, auditable output. The agent never guesses — it queries, proposes, validates, and applies through governed tool calls.

---

## Alternate Demo: "Brand Theming in 60 Seconds"

For audiences focused on design ops rather than code generation:

1. `tokens.build` — Show the current token artifact (base + semantic + component layers)
2. `brand.apply` with a minimal delta — Change primary color + border radius
3. Show the diff output: which tokens changed across base/dark/high-contrast themes
4. Show `variables.css` output: production-ready CSS custom properties

**Message:** "Your design system has 500+ tokens. Theming means changing 3 values and getting governed output across all themes, with contrast validation included."

---

## Alternate Demo: "Component Intelligence for Code Gen"

For audiences focused on AI-assisted development:

1. `catalog.list` with trait filter — "Show me everything with the Statusable trait"
2. Point out `codeSnippet` field — Real import + JSX, not hallucinated
3. `repl.validate` with a schema using those components — Prove the system catches errors
4. Compare with typical LLM code generation — No registry, no validation, no governance

**Message:** "Every other AI coding tool guesses at your component API. This one reads from a semantic registry and validates before rendering."

---

## What NOT to Demo

- No references to Stage1, inspection, or crawling
- No references to the Synthesis Workbench
- No "coming soon" generative UI features
- No external URLs or live-site scanning
- Everything runs against local structured data artifacts

---

## Technical Requirements

- Node.js 18+
- `pnpm install && pnpm --filter @oods/mcp-server run build`
- MCP client connected via stdio (see `docs/mcp/Connections.md`)
- OR use the CLI: `pnpm exec tsx tools/oods-agent-cli/src/index.ts plan <tool> '<json>'`

---

## Inventory Numbers (as of 2026-02-24)

| Asset | Count |
|-------|-------|
| Components | 73 |
| Traits | 35 |
| Objects | 12 |
| Auto MCP tools | 6 |
| On-demand tools | 10 |
| Storybook stories | 76 |

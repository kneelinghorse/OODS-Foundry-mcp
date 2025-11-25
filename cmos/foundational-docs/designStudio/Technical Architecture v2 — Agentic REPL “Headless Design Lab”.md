# Technical Architecture v2 — Agentic REPL “Headless Design Lab”

This is the updated technical architecture for the Agentic REPL, incorporating the concrete improvements around schema design, RAG, MCP tools, renderer behavior, and product UX.

---

## 1. Core Concept: The Agentic REPL

Instead of a canvas where an agent moves rectangles, the system is a **Read–Eval–Print Loop (REPL) for UI**:

* **Read**: Agent ingests UX research + prior designs + design system docs.
* **Eval**: Agent selects & configures components from the Design System (DS) using tools.
* **Print**: System renders a live UI from a **Declarative UI Schema (JSON)**.

The LLM **never outputs React/Vue directly**. It emits JSON that references the DS and is guaranteed-valid (or repairable) via validation tools and the renderer. 

### 1.1 Loop contract (per turn)

Each REPL turn follows a strict contract:

1. **Read**

   * Pull relevant context from:

     * RAG (personas, JTBD, UX findings, prior approved designs).
     * Design System schema (components, tokens, guidelines).
     * Current UI JSON (if refining an existing design).

2. **Plan**

   * Decide whether this turn:

     * Creates a new layout.
     * Refines an existing layout.
     * Applies a small patch (e.g. “make cards denser”, “optimize for mobile”).

3. **Eval**

   * Use MCP tools to:

     * Discover components and tokens.
     * Construct or **patch** the JSON UI tree.
     * Call `validate_ui_tree(json)` to ensure schema + DS correctness.
     * Optionally call `render_ui(json)` in a “dry run” mode (no user-visible update) to detect runtime issues.

4. **Print**

   * On success:

     * Call `render_ui(json_or_patch)` to update the preview.
   * On failure:

     * Read back `validate_ui_tree`/`render_ui` errors.
     * Repair JSON and re-run.
   * Log: prompt, retrieved context, JSON diff, validation errors, render result.

### 1.2 Incremental editing (patch-based REPL)

To feel truly REPL‑like, the agent supports **incremental edits**, not only full tree rewrites:

* **Full tree**: replace entire JSON when generating a brand new design.
* **Patch mode**: via `update_ui_patch(patch)` or `render_ui(patch)`:

  * Patches can follow a JSON Patch–style syntax or a simpler `{ nodeId, path, value }` contract.
  * Example: “increase spacing between cards” → update a single `gapToken` field.
* This keeps payloads small, reduces error surface, and allows fine-grained UX tweaks. 

---

## 2. Declarative UI Schema (JSON DSL)

The Declarative UI Schema is the **single source of truth** for designs. The agent, renderer, and tools all speak this DSL.

### 2.1 Top-level schema

Conceptually:

```ts
type UISchema = {
  version: string;          // DSL version
  theme?: string;           // e.g. 'default', 'dark', 'brandX'
  dsVersion?: string;       // Design System version, e.g. '3.2.1'
  screens: UIScreen[];
};

type UIScreen = UIElement & {
  id: string;               // unique id for the screen/route
  route?: string;           // optional route or tab id
};
```

### 2.2 UIElement shape

```ts
type UIElement = {
  id: string;               // stable id for patches, comments, analytics
  component: string;        // DS component name (e.g. 'Page', 'UserCard')

  layout?: {
    type?: 'stack' | 'grid' | 'inline' | 'section' | 'sidebar';
    align?: 'start' | 'center' | 'end' | 'space-between';
    gapToken?: string;      // e.g. 'spacing.md'
    // future: columns, breakpoints, etc.
  };

  props?: Record<string, unknown>;        // static values
  bindings?: Record<string, string>;      // runtime data bindings (e.g. 'persona.sarah.bio')

  children?: UIElement[];

  meta?: {
    label?: string;         // human-readable label
    intent?: string;        // 'hero', 'primary-cta', 'filter-section', etc.
    notes?: string;         // design notes, rationale, comments
  };
};
```

Key points:

* **Stable `id` per node** enables:

  * Patches (`update_ui_patch`).
  * Comment threads anchored to specific elements.
  * Analytics on element usage.
* **`meta.intent`** lets you query patterns later (e.g. “all hero sections across dashboards”).
* **`props` vs `bindings`**:

  * `props`: static configuration (variants, tokens, boolean flags).
  * `bindings`: references to persona data, mock API data, etc., e.g.:

    ```json
    {
      "id": "sarah-summary-card",
      "component": "UserCard",
      "props": {
        "variant": "primary",
        "elevationToken": "shadow.sm"
      },
      "bindings": {
        "data": "persona.sarah.bio"
      },
      "meta": {
        "label": "Persona summary",
        "intent": "hero-context"
      }
    }
    ```

### 2.3 Tokens & style discipline

Tokens should be **explicit and lintable**, not arbitrary strings:

* Prefer `spacing.md` over `token.spacing.md` or raw pixel values.

* Group style under a `style` sub-object if needed:

  ```json
  {
    "style": {
      "spacingToken": "spacing.md",
      "radiusToken": "radius.md",
      "shadowToken": "shadow.sm"
    }
  }
  ```

* MCP `list_tokens(category?: string)` helps the agent avoid hallucinated tokens. 

### 2.4 Multi-screen flows

The DSL is **multi-screen** from day one:

* `screens` is an array: each screen is a `Page`-like root element.
* Renderer can:

  * Render a specific screen (e.g. current route).
  * Show tabs/routes in the preview to navigate flows.

Example full payload:

```json
{
  "version": "1.0.0",
  "theme": "default",
  "dsVersion": "3.2.1",
  "screens": [
    {
      "id": "dashboard-main",
      "component": "Page",
      "layout": {
        "type": "grid",
        "gapToken": "spacing.md"
      },
      "children": [
        {
          "id": "sarah-summary-card",
          "component": "UserCard",
          "props": {
            "variant": "primary",
            "elevationToken": "shadow.sm"
          },
          "bindings": {
            "data": "persona.sarah.bio"
          },
          "meta": {
            "label": "Persona summary",
            "intent": "hero-context"
          }
        }
      ]
    }
  ]
}
```

---

## 3. Layer 1 – Context Engine (The Brain)

**Goal**: make the agent *design-aware*, not just “generic RAG.”

### 3.1 Sources

* **Research corpus**

  * Personas.
  * JTBD documents.
  * UX findings, interviews, surveys.
  * Design principles / accessibility guidelines.

* **Implementation corpus**

  * DS docs: component APIs, usage guidelines, “do & don’t” examples.
  * Layout “recipes”: “KPI card patterns”, “table + filters”, “left-nav dashboards”.
  * Previously accepted JSON designs.

All of these are embedded into a vector DB (e.g. Chroma, Pinecone) with tags.

### 3.2 Indexing & tagging

Tag documents heavily for precise retrieval:

* `persona:sarah`, `persona:analyst`
* `flow:onboarding`, `flow:activation`
* `pattern:dashboard`, `pattern:filters`, `pattern:hero`
* `component:UserCard`, `component:DataTable`
* `quality:approved-design`, `quality:guideline`

### 3.3 Retrieval patterns (“recipes”)

RAG calls are structured according to the design problem:

* “Design a dashboard for Sarah”

  * Retrieve: `persona:sarah`, `pattern:dashboard`, `pattern:card-layout`.
* “Make the filters easier to use”

  * Retrieve: `pattern:filters`, `guideline:accessibility`, `guideline:mobile`.
* “Make this more conversion-focused”

  * Retrieve: docs tagged `goal:conversion`, `pattern:hero`, `pattern:cta`.

### 3.4 House-style memory

Accepted designs are also indexed as RAG documents:

* Stored as:

  * JSON schema (`UISchema`).
  * Screenshots / textual summaries (for RAG).
* Tagged by:

  * Persona, flow, product area, theme.
* The agent can retrieve and reference them:

  * “Make something similar to the existing Sales Overview dashboard, but for persona X.”

This gives the agent a **“house style”** without model fine-tuning. 

---

## 4. Layer 2 – Interface (MCP Tool Surface)

The Interface layer exposes the system to the LLM via **Model Context Protocol (MCP)** tools.

### 4.1 Core tools

1. **`get_component_schema(name?: string)`**

   * No args: returns DS overview (list of components, high-level props).
   * With `name`: detailed schema:

     * Required/optional props.
     * Allowed children.
     * Example JSON snippets.

2. **`search_components(query: string)`**

   * Semantic search over components:

     * e.g. “filters”, “hero section”, “KPI card”.
   * Returns candidate components + usage notes.

3. **`list_tokens(category?: string)`**

   * Exposes valid tokens:

     * Spacing, radius, color, shadow, typography, etc.
   * Helps agent pick `spacing.md`, `shadow.sm`, etc., rather than hallucinating.

4. **`validate_ui_tree(json: UISchema)`**

   * Runs:

     * JSON Schema validation (shape of DSL).
     * DS rules (required props, allowed children, token existence).
   * Returns structured results:

     * `errors`: missing props, invalid tokens, invalid component names.
     * `warnings`: non-fatal issues (too many CTAs, risky patterns, etc.).

5. **`render_ui(json_or_patch)`**

   * Main bridge to the Renderer.
   * Input:

     * Full `UISchema` (for initial render or full rewrite), or
     * Patch object (for incremental edits).
   * Output:

     * `status: 'ok' | 'error'`
     * `errors`: runtime rendering errors (e.g. prop type mismatches).
     * Optional preview metadata (screen ids, route info).

6. **`update_ui_patch(patch)`** (if not folded into `render_ui`)

   * Applies patch to the current stored design.
   * Returns updated canonical JSON.

7. **`save_design(name, json)` / `load_design(id)`**

   * Persistence functions:

     * Let agent label & retrieve designs.
   * Used for:

     * Snapshots per turn.
     * “Load the v3 version of this dashboard and adjust it for mobile.”

### 4.2 Tool usage pattern in the agent

Per turn, the agent:

1. Calls `get_component_schema` / `search_components` / `list_tokens` to explore DS options.
2. Builds or patches JSON in the DSL format.
3. Calls `validate_ui_tree` until there are no blocking errors.
4. Calls `render_ui` to update the preview.
5. Optionally calls `save_design` for checkpoints.

---

## 5. Layer 3 – Renderer (Hot-Swapping Preview App)

The Renderer is a **blank shell app** (e.g. Vite + React) that:

* Hosts your existing Design System.
* Exposes a `JSONRenderer` component that transforms the JSON UI tree into DS components.
* Backs the right-hand “preview” pane of the Design Lab UI.

### 5.1 JSONRenderer

Responsibilities:

* Accept a `UISchema` + active screen.

* Recursively render `UIElement` nodes via a `componentRegistry`:

  ```ts
  const componentRegistry = {
    Page,
    Stack,
    Grid,
    UserCard,
    DataTable,
    // …
  };
  ```

* If a component name is missing:

  * Render an “Unknown component” placeholder.
  * Emit an error back to `render_ui`.

### 5.2 Layout primitives

To avoid arbitrary nested div chaos, define **layout primitives**:

* `Page`, `Section`, `Stack`, `Grid`, `SidebarLayout`, etc.
* Encourage the agent (via docs/prompts) to compose UIs using these.
* These components encapsulate responsive behavior and spacing decisions, keeping designs consistent and mobile-friendly by default. 

### 5.3 Error surfacing

The renderer must **never silently fail**:

* Capture runtime errors:

  * Missing required props.
  * Invalid prop types.
  * Unknown tokens (if not caught earlier).
* Return them via `render_ui` as structured error payloads.
* Agent uses those to repair the JSON and retry without human intervention.

### 5.4 Multi-screen support

Renderer supports:

* Multiple screens/routes defined in `screens`.
* UI to:

  * Select screen (dropdown/tabs).
  * Preview flows (e.g. “click this card” simulates a route change to another screen id).

---

## 6. Product UX: The “Design Lab” App

The Design Lab is a **three-pane dashboard** for interactive design.

### 6.1 Layout

1. **Left pane – Chat & Context**

   * Chat with the agent.
   * Chips / badges listing:

     * Active persona(s).
     * JTBD / goal.
     * Key research chunks retrieved for this turn.
   * Controls for:

     * High-level instructions (“more compact”, “mobile-first”, “increase scannability”).

2. **Middle pane – JSON / Logic**

   * Shows the current `UISchema` for the active design.
   * Allow manual editing for advanced users:

     * Tweak tokens.
     * Rename ids.
   * Show diffs between turns:

     * “What changed from v3 → v4?”

3. **Right pane – Live Preview**

   * Renders UI via `JSONRenderer`.
   * Screen selector (if multi-screen).
   * Optional device preview (desktop / tablet / mobile).

### 6.2 REPL UX features

* **History & snapshots**

  * Per chat turn, save a snapshot via `save_design`.
  * UI to:

    * Browse history.
    * Diff versions.
    * “Rollback to v3”.

* **Explainability**

  * Button: “Explain this design”.
  * Agent reads:

    * Current JSON.
    * Research context used to create it.
  * Returns rationale: why layout, component choices, and hierarchy were chosen.

* **High-level knobs**

  * Predefined modifiers like:

    * “More compact / more spacious”
    * “Prioritize conversion over exploration”
    * “Optimize for mobile”
  * These map to:

    * Token changes (spacing, typography).
    * Layout changes (stack vs grid, card density).
    * Possibly different retrieved guidelines.

* **Comment & review mode**

  * Attach comments to node ids.
  * Agent can:

    * Read comments as input (“design review notes”).
    * Propose changes to address them (patches to the JSON).

---

## 7. Tooling / Implementation Path

Rather than one big bang, the stack evolves in phases.

### Phase 1 – “Filesystem as API” (Option A)

* Use **Ladle or Storybook** as the renderer.
* Flow:

  * Agent generates `.stories.tsx` in a watched folder.
  * Ladle hot reloads and renders.
* Pros:

  * Fast to bootstrap with existing tools.
* Cons:

  * Agent must emit syntax-correct TSX.
  * No JSON DSL yet; higher error rate.

### Phase 2 – Custom “Design Lab” (Option C, primary target)

* Implement the JSON DSL and `JSONRenderer`.
* Build the three-pane Design Lab app.
* Make JSON the **single source of truth**.
* Use MCP tools from Section 4 as the main integration.

### Phase 3 – Optional “Headless Builder” (Option B)

* If needed, integrate **Builder.io** as a specialized renderer for rich content layouts:

  * Agent outputs Builder-compatible JSON for specific experiences.
* Only if the native DSL + renderer is insufficient for some use cases.

---

## 8. Non-functional: Versioning, Testing, Governance

To keep the system robust over time: 

* **Versioning**

  * `UISchema.version` for the DSL.
  * `dsVersion` for the Design System.
  * Migration scripts when DS/DSL evolve.

* **Testing & linting**

  * Golden JSON fixtures + snapshot tests for the renderer.
  * Lint rules, e.g.:

    * Max number of primary CTAs per screen.
    * Minimum color contrast thresholds.
    * Presence of focus states.
  * Some rules can be enforced statically; others via LLM-assisted checks.

* **Analytics**

  * Log:

    * Prompt → retrieved context → JSON diff → validation/render errors → final state.
  * Use analytics to:

    * Identify common design patterns.
    * Spot frequent validation issues.
    * Improve prompts, DS documentation, and tooling where friction appears.

---

This v2 architecture keeps the original “Agentic REPL / Headless Design Lab” shape but makes it **much more concrete**: a formal JSON DSL, a structured REPL loop with patches and validation, a design-aware RAG stack, a richer MCP tool surface, and a practical product UX for real-world collaborative UI design.

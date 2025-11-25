Headless Design Lab & Agentic Rendering Engine — Integrated Spec (v0.2)
0. System Summary

Goal: Turn UX research + personas into live, production‑ready UI using an Agent that speaks JSON, not TSX.

Core principle:
UI = f(JSON) — The Agent emits a declarative UI schema; the ARE turns it into a live React tree using your Design System.

Stack: OpenAI/MCP + vector DB + Node MCP server + React + TypeScript + Zod + Zustand. 

Technical-roadmap-Agentic REPL

 

Agentic Rendering Engine-spec

1. Layered Architecture
Layer 0 – UX Assets (Inputs)

Personas, JTBD docs, research PDFs, product specs.

Layer 1 – Context Engine (RAG)

Responsibility: Retrieve relevant research for the current task (“dashboard for Sarah”, “onboarding flow”, etc.).

Components:

Vector DB (e.g., Chroma/Pinecone).

Embedding + retrieval pipeline.

Output: Small set of chunks: persona:sarah, pattern:dashboard, etc., injected into the Agent’s context. 

Technical-roadmap-Agentic REPL

Layer 2 – Agent + UI DSL

Responsibility: Turn natural language + retrieved context + DS schema into a UI schema JSON.

The Agent:

Calls get_component_schema() via MCP to learn the DS.

Reads UX context from RAG.

Produces UISchema (high‑level DSL, see §2).

Layer 3 – Agentic Rendering Engine (ARE)

Responsibility: Convert UISchema → renderable AgentNode tree → React DOM using your DS.

Key properties:
Pure function, aggressive validation, “fail gracefully, render instantly.” 

Agentic Rendering Engine-spec

Layer 4 – Design Lab UI

Responsibility: Human interface:

Left: chat/context.

Middle: JSON (UISchema) view and/or diff.

Right: live preview powered by ARE. 

Technical-roadmap-Agentic REPL

2. Data Models
2.1 High‑Level UI DSL (UISchema)

This is what the Agent emits.

// Top-level document
type UISchema = {
  version: string;         // DSL version, e.g. "1.0.0"
  theme?: string;          // 'default' | 'dark' | 'highContrast'
  screens: UIScreen[];
};

type UIScreen = {
  id: string;              // stable per screen
  name?: string;
  root: UIElement;         // root element for this screen
};

type UIElement = {
  id: string;              // stable per node
  component: string;       // maps to DS component, e.g. "UserCard"
  props?: Record<string, unknown>;
  layout?: LayoutConfig;   // spacing, alignment, etc.
  bindings?: Record<string, string>; // e.g. "data": "persona.sarah.bio"
  children?: UIElement[];
  meta?: {
    label?: string;        // human-readable
    intent?: string;       // 'hero', 'primary-cta', 'filter-bar', etc.
    notes?: string;        // design rationale
  };
};

type LayoutConfig = {
  display?: 'stack' | 'grid' | 'inline';
  gapToken?: string;       // 'spacing.md', etc.
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'space-between';
};


Important: UISchema is the design‑level language (persona‑aware, layout‑aware). It is compiled into a leaner rendering IR for the ARE.

2.2 Rendering IR (AgentNode)

This is what the ARE consumes. It’s intentionally minimal. 

Agentic Rendering Engine-spec

type AgentNode = {
  // Component identifier, must exist in Component Registry
  type: string;
  // Props after compilation (includes layout/binding details as plain props)
  props?: Record<string, unknown>;
  // Children are *only* other nodes (no raw strings)
  children?: AgentNode[];
  // Stable identifier for keys, selection, history
  id?: string;
  // Optional explicit React key (if different from id)
  key?: string;
};


Text is represented as type: "Text", props: { value: string } rather than mixing strings into children. That keeps validation, transforms, and diffing simple.

2.3 Compiler: UISchema → AgentNode

A compile step runs on the MCP server:

function compileElement(el: UIElement): AgentNode {
  return {
    type: el.component,
    id: el.id,
    key: el.id,
    props: {
      ...el.props,
      layout: el.layout,
      bindings: el.bindings,
      // tokens, variants, etc. are all props understood by DS components
    },
    children: el.children?.map(compileElement),
  };
}

function compileUISchema(ui: UISchema): AgentNode {
  // v0: assume a single screen for render
  return compileElement(ui.screens[0].root);
}


This keeps the ARE narrowly focused on “JSON → DS components” and lets the DSL evolve without touching the renderer.

3. MCP Tool Surface

These are the tools exposed to the Agent. 

Technical-roadmap-Agentic REPL

3.1 get_component_schema
// Input
type GetComponentSchemaRequest = {
  name?: string; // optional: specific component
};

// Output
type ComponentSchema = {
  name: string;
  props: Record<string, unknown>;  // structured description
  slots?: string[];
  tokens?: string[];
  examples?: UISchema[];            // optional examples
};

type GetComponentSchemaResponse = {
  components: ComponentSchema[];
};

3.2 render_ui
// Input
type RenderUIRequest = {
  sessionId: string;    // conversation/session
  ui: UISchema;         // high-level schema from Agent
};

// Output
type RenderUIResponse = {
  status: 'ok' | 'validation_error';
  errors?: ValidationError[];
};

type ValidationError = {
  path: string;         // JSONPath to field
  message: string;
};


Server flow:

Validate ui against UISchema JSON Schema.

Compile UISchema → AgentNode.

Validate AgentNode via ARE’s registry + Zod.

If valid: push compiled tree over WebSocket as RENDER_UPDATE.

If invalid: return validation_error + machine‑readable errors so the Agent can repair.

3.3 Optional helper tools

validate_ui(ui: UISchema)

get_current_ui(sessionId)

update_ui_patch(sessionId, patch)

These enable incremental edits and more advanced REPL behavior later.

4. Agentic Rendering Engine (ARE)

This section is the refined version of your renderer spec, plugged into the architecture. 

Agentic Rendering Engine-spec

4.1 Module 1 – Component Registry

Maps AgentNode.type → React component + Zod schema + metadata.

import { z } from 'zod';
import { Button, Card, Layout } from '@my-org/design-system';

type RegistryEntry = {
  component: React.ComponentType<any>;
  schema: z.ZodTypeAny;
  meta?: {
    displayName?: string;
    category?: 'layout' | 'input' | 'display' | 'feedback';
    description?: string;
    allowedChildren?: string[]; // component names
  };
};

export const COMPONENT_REGISTRY: Record<string, RegistryEntry> = {
  Button: {
    component: Button,
    schema: z.object({
      label: z.string(),
      variant: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
      disabled: z.boolean().optional(),
    }),
    meta: { category: 'input', displayName: 'Button' },
  },
  Card: {
    component: Card,
    schema: z.object({
      elevation: z.number().min(0).max(5),
      padding: z.string().optional(),
    }),
    meta: { category: 'layout', displayName: 'Card' },
  },
  // ...
};

4.2 Module 2 – Prop Sanitizer & Safety

Responsibilities:

Enforce component prop contracts.

Strip unsafe props.

Fail softly — keep valid props where possible.

const sanitizeProps = (type: string, rawProps: any): Record<string, unknown> => {
  const entry = COMPONENT_REGISTRY[type];
  if (!entry || !rawProps) return {};

  // 1. Security: strip event handlers, functions, dangerous fields
  const securitySafe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawProps)) {
    if (key.startsWith('on')) continue;                    // no event handlers
    if (key === 'dangerouslySetInnerHTML') continue;       // no raw HTML
    if (typeof value === 'function') continue;             // no functions
    securitySafe[key] = value;
  }

  // 2. Zod validation with partial salvage
  const result = entry.schema.safeParse(securitySafe);
  if (result.success) return result.data;

  console.warn(`Bad props for ${type}`, result.error);

  // Optional: best-effort salvage — keep fields that validate alone
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(securitySafe)) {
    const singleSchema = entry.schema.pick({ [key]: true as any });
    const single = singleSchema.safeParse({ [key]: (securitySafe as any)[key] });
    if (single.success) cleaned[key] = (securitySafe as any)[key];
  }
  return cleaned;
};

4.3 Module 3 – Recursive Tree Resolver
type AgentRendererProps = { node: AgentNode };

const AgentRenderer: React.FC<AgentRendererProps> = ({ node }) => {
  const entry = COMPONENT_REGISTRY[node.type];

  if (!entry) {
    // Visible placeholder for unknown components
    return (
      <div style={{ border: '1px dashed #f00', padding: 8 }}>
        Unknown component: {node.type}
      </div>
    );
  }

  const Component = entry.component;
  const safeProps = sanitizeProps(node.type, node.props);

  return (
    <NodeErrorBoundary fallback={<div>Component failed: {node.type}</div>}>
      <Component {...safeProps}>
        {node.children?.map((child, index) => (
          <AgentRenderer
            key={child.id ?? child.key ?? index}
            node={child}
          />
        ))}
      </Component>
    </NodeErrorBoundary>
  );
};

export const EngineRoot: React.FC<{ data: AgentNode }> = ({ data }) => (
  <GlobalErrorBoundary fallback={<div>Critical Rendering Error</div>}>
    <div className="agent-canvas-root">
      <AgentRenderer node={data} />
    </div>
  </GlobalErrorBoundary>
);


NodeErrorBoundary protects each node so one broken card doesn’t nuke the whole screen.

GlobalErrorBoundary protects against catastrophic issues.

4.4 Module 4 – Canvas Shell (Isolation)
export const CanvasShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div id="agent-canvas-container">
    {children}
  </div>
);

/* agent-canvas.css */

#agent-canvas-container * {
  box-sizing: border-box;
  font-family: 'Inter', sans-serif;
  line-height: 1.5;
}

#agent-canvas-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background-color: #ffffff;
  position: relative;
  isolation: isolate;
}


Optionally wrap in a <DesignSystemThemeProvider> with a neutral theme.

Later, you can move this into a Shadow DOM if global style bleed becomes an issue.

4.5 Module 5 – Hot‑Swap Interface (Store + Socket)

Zustand store:

interface SessionState {
  tree: AgentNode | null;
  history: AgentNode[];
}

interface DesignState {
  sessions: Record<string, SessionState>;
  updateTree: (sessionId: string, newTree: AgentNode) => void;
}

export const useDesignStore = create<DesignState>((set) => ({
  sessions: {},
  updateTree: (sessionId, newTree) =>
    set((state) => {
      const prev = state.sessions[sessionId] ?? { tree: null, history: [] };
      const nextHistory = prev.tree ? [...prev.history, prev.tree] : prev.history;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { tree: newTree, history: nextHistory.slice(-50) }, // cap history
        },
      };
    }),
}));


WebSocket listener:

const useAgentSocket = (sessionId: string) => {
  const updateTree = useDesignStore((s) => s.updateTree);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080/agent-stream');

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'RENDER_UPDATE' && payload.sessionId === sessionId) {
        updateTree(sessionId, payload.jsonTree);
      }
    };

    return () => socket.close();
  }, [sessionId, updateTree]);
};


Frontend loop:

render_ui MCP → server validates/compiles → sends RENDER_UPDATE with { sessionId, jsonTree } → store updates → EngineRoot re-renders inside CanvasShell.

5. Design Lab Application

At the app level:

Left Pane: Chat + visible “active context” (which personas/JTBD chunks were used).

Middle Pane: UISchema viewer/editor (and diff vs previous).

Right Pane: <CanvasShell><EngineRoot data={currentTree} /></CanvasShell>. 

Technical-roadmap-Agentic REPL

Optional quality-of-life:

Undo/redo based on history.

“Explain this design” button (Agent reads UISchema + context and narrates choices).

Viewport toggles (desktop/tablet/mobile widths).
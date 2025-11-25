# Roadmap: The Agentic REPL

## Vision

Transform the design process from manual vector manipulation to a conversational, data-driven workflow. We will build a "Headless Design Lab" where an AI agent, guided by UX research, generates production-ready UI by composing components from our existing design system.

**Core Principle**: The output of design is not a picture of a UI, but a declarative UI schema that renders the real UI.

---

## Phases Overview

### Phase 1: Foundation (Sprint 02)
**Status**: In Progress
**Goal**: Build the core infrastructure for the Agentic REPL.

#### Sprint 02 Objectives
1.  **MCP Server Extension**: Implement the `get_component_schema()` and `render_ui(json_payload)` tools in the existing `mcp-server`.
2.  **JSON Renderer Component**: Create a `JSONRenderer` React component capable of recursively rendering a UI from a JSON schema.
3.  **Storybook Integration**: Create an "Agent Preview" story in the existing Storybook setup to host the `JSONRenderer`.
4.  **End-to-End Test**: Demonstrate the core loop: Agent generates JSON -> `render_ui` is called -> UI is rendered in the Storybook preview.

#### Success Criteria
- Agent can successfully get the design system schema via an MCP tool.
- Agent can generate a valid JSON UI schema.
- The `JSONRenderer` can render a simple UI from the agent's JSON.
- A live demo of the core loop is functional.

---

### Phase 2: Context Engine & Intelligence (Sprint 03)
**Status**: Planned
**Goal**: Empower the agent with knowledge of the project's UX research.

#### Sprint 03 Objectives
1.  **Vector Database Setup**: Ingest UX research documents (personas, JTBDs, etc.) into a vector database (e.g., ChromaDB).
2.  **RAG Pipeline**: Implement a Retrieval-Augmented Generation (RAG) pipeline.
3.  **New MCP Tool**: Create a `query_research(question)` MCP tool that allows the agent to query the vector database.
4.  **Enhanced Design Briefs**: The agent can now use the `query_research` tool to create more informed design briefs.

#### Success Criteria
- Agent can answer questions about UX research by querying the vector database.
- Agent can generate a UI that is demonstrably influenced by the content of the UX research.
- The "Context" pane in the three-pane dashboard concept can show which research chunks are being used.

---

### Phase 3: The "Design Lab" UI (Sprint 04)
**Status**: Planned
**Goal**: Build a user-friendly interface for interacting with the Agentic REPL.

#### Sprint 04 Objectives
1.  **Three-Pane Dashboard**: Build the three-pane UI as described in "The Agentic REPL.md":
    *   **Left Pane (Context)**: Chat interface.
    *   **Middle Pane (Logic)**: Editable raw JSON output.
    *   **Right Pane (Preview)**: The live-rendered UI (our Storybook "Agent Preview" story embedded).
2.  **Real-time JSON Editing**: Changes made to the JSON in the middle pane are reflected in the preview pane in real-time.
3.  **Agent Interaction**: The chat interface can trigger the agent to generate new UI schemas.

#### Success Criteria
- The three-pane dashboard is functional.
- A user can have a conversation with the agent, see the JSON output, and see the rendered UI all in one place.
- A user can manually edit the JSON and see the UI update instantly.

---

### Phase 4: Production & Polish (Sprint 05+)
**Status**: Future
**Goal**: Harden the platform and integrate it into the daily design workflow.

#### Planned Enhancements
-   **Advanced Component Support**: Ensure the `JSONRenderer` supports all components in the design system.
-   **Error Handling**: Provide clear error messages when the agent generates invalid JSON or uses components incorrectly.
-   **Performance Optimization**: Ensure the renderer and the agent's responses are fast.
-   **Deployment**: Deploy the Design Lab as an internal tool.
-   **User Onboarding**: Create documentation and training for designers.

---

# Design Lab Shell

A three-pane React harness for editing and validating Design Lab UI schemas against the MCP renderer/validator tools. It wraps `repl.render` and `repl.validate`, injects its own styles, and includes an agent lane that proposes patches from registry hints.

## What it does

- Renders JSON editors for **full** schemas and **patch** mode, then calls `renderDesignLab` / `validateDesignLab` (or a custom renderer prop) to preview and validate.
- Keeps the last five rendered trees as snapshots and shows a diff summary between the most recent two renders.
- Agent lane runs `structuredData.fetch` for components/tokens, builds a prompt-driven plan via `buildAgentPlan`, validates it, and renders the result while logging tool steps in the chat.
- Auto-injects shell styles via `ensureDesignLabStyles` and surfaces renderer status/warnings with minimal console telemetry.

## Usage

Prereqs:
- Build or use sources from `packages/mcp-server` so `repl.render.js` and `repl.validate.js` are available.
- Refresh structured data once so registry hints are present (`pnpm refresh:data` writes `cmos/planning/oods-components.json` and `oods-tokens.json`).

Embed the shell in Storybook or any React view:

```tsx
import { DesignLabShell } from '../../tools/design-lab-shell/src';
import { sampleSchema } from '../../tools/design-lab-shell/src/sampleSchema';

export function DemoLab() {
  return <DesignLabShell schema={sampleSchema} title="Design Lab" />;
}
```

To point at a remote renderer, pass a `renderer` prop that matches `RenderRequest -> RenderResponse`:

```tsx
<DesignLabShell schema={schema} renderer={(request) => remoteRenderer(request)} />
```

## Workflow notes

- Modes: **Full** edits a complete `UiSchema`; **Patch** applies JSON Patch operations to the last rendered tree (requires a base tree from a full render).
- Validate runs `repl.validate` with `includeNormalized` and `checkComponents`; Apply runs `repl.render`, captures `renderedTree`, and stores registry/version metadata for hints.
- Snapshots are capped at five; diffs list added/removed/changed paths between the two most recent snapshots.
- Agent lane uses registry summaries (component names, etags, counts) to seed patches, validates them, and records each tool call (`structuredData.fetch`, `validate_ui_tree`, `render_ui`) in the chat log.
- Status pills and issue summaries surface renderer errors, missing base trees, or JSON parsing issues quickly.

## Integration tips

- Ensure `@oods/mcp-server` is built (`pnpm --filter @oods/mcp-server build`) if you rely on dist outputs; otherwise the shell imports the TS sources.
- Keep registry hints fresh by running `pnpm refresh:data` before demos so the agent lane can cite current component/token summaries.
- For Storybook embeds, give the container ~1100px width for the three-column layout; the shell collapses to a single column automatically on smaller viewports.

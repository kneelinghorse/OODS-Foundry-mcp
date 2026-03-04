# s59-m06 Codegen Parity Check (React vs Vue)

Date: 2026-03-04

## Scope

Generated React and Vue outputs from `code.generate` for three representative fixtures:

- `dashboard-page.ui-schema.json`
- `form-page.ui-schema.json`
- `detail-page.ui-schema.json` (new; sidebar + detail components)

All outputs were generated with `options: { styling: "tokens", typescript: true }`.

## Parity Findings

- **Component coverage:** React and Vue output include the same component tags for each fixture.
- **Data attributes:** Both emit `data-oods-component` consistently. Layout metadata appears in both (e.g., `data-layout="sidebar"` and `data-layout-node-id` for section layouts).
- **Layout wrappers:** Sidebar layout wraps children identically (main + aside wrappers). Vue uses SFC template structure; React uses JSX fragment wrapper.
- **Prop serialization:** Arrays and objects are emitted as JSON payloads in both frameworks (React as JSX expressions, Vue as `v-bind` expressions).
- **Token styling:** Layout + style tokens emit `var(--ref-*)` in both. React uses style objects; Vue uses inline CSS strings. Vue adds a scoped style block only when token references exist.

## React Syntax Verification

- Style output is `style={{ ... }}` (no triple-brace regression).
- Props serialize cleanly for strings, numbers, booleans, arrays, and objects.
- TypeScript output uses `.tsx` with `React.FC` and component prop typedefs; no syntax violations observed.

## Tests Added

- Golden output tests: `packages/mcp-server/test/contracts/code.generate-golden.spec.ts`
- Golden fixture outputs: `packages/mcp-server/test/fixtures/codegen/`
- New fixture: `packages/mcp-server/test/fixtures/ui/detail-page.ui-schema.json`

## Notes

If emitter output changes are intentional in the future, update the golden fixtures to reflect the new canonical output.

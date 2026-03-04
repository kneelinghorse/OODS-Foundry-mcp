/**
 * E2E coverage for schemaRef passthrough across compose → validate → render → code.generate.
 */
import { describe, it, expect } from 'vitest';
import { handle as composeHandle } from '../../packages/mcp-server/src/tools/design.compose.js';
import { handle as validateHandle } from '../../packages/mcp-server/src/tools/repl.validate.js';
import { handle as renderHandle } from '../../packages/mcp-server/src/tools/repl.render.js';
import { handle as codegenHandle } from '../../packages/mcp-server/src/tools/code.generate.js';

const COMPOSE_INPUT = {
  intent: 'Account detail view with tabs for Overview, Billing, Activity, Settings.',
  layout: 'detail',
  preferences: {
    tabCount: 4,
    tabLabels: ['Overview', 'Billing', 'Activity', 'Settings'],
  },
  options: { topN: 1 },
} as const;

function payloadBytes(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8');
}

describe('schemaRef E2E pipeline', () => {
  it('compose → validate → render → code.generate accepts schemaRef', async () => {
    const compose = await composeHandle(COMPOSE_INPUT);
    expect(compose.status).toBe('ok');
    expect(compose.schemaRef).toBeTruthy();

    const schemaRef = compose.schemaRef!;
    const validation = await validateHandle({ mode: 'full', schemaRef });
    expect(validation.status).toBe('ok');

    const render = await renderHandle({ mode: 'full', schemaRef, apply: true });
    expect(render.status).toBe('ok');
    expect(render.html).toContain('<!DOCTYPE html>');

    const codegen = await codegenHandle({ schemaRef, framework: 'react' });
    expect(codegen.status).toBe('ok');
    expect(codegen.code.length).toBeGreaterThan(0);
  });

  it('schemaRef payloads are substantially smaller than schema passthrough', async () => {
    const compose = await composeHandle(COMPOSE_INPUT);
    expect(compose.status).toBe('ok');
    expect(compose.schemaRef).toBeTruthy();

    const schemaRef = compose.schemaRef!;
    const schema = compose.schema;

    const schemaPayloads = [
      { mode: 'full', schema },
      { mode: 'full', schema, apply: true },
      { schema, framework: 'react' },
    ];

    const refPayloads = [
      { mode: 'full', schemaRef },
      { mode: 'full', schemaRef, apply: true },
      { schemaRef, framework: 'react' },
    ];

    const schemaBytes = schemaPayloads.reduce((sum, payload) => sum + payloadBytes(payload), 0);
    const refBytes = refPayloads.reduce((sum, payload) => sum + payloadBytes(payload), 0);

    expect(refBytes).toBeLessThan(schemaBytes * 0.2);
  });
});

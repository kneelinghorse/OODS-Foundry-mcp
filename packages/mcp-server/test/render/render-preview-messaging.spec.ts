import { describe, expect, it } from 'vitest';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle } from '../../src/tools/repl.render.js';

const VALID_SCHEMA: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'screen-root',
    component: 'Stack',
    children: [{
      id: 'primary-button',
      component: 'Button',
      props: { label: 'Save' },
    }],
  }],
};

const INVALID_SCHEMA: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'screen-root',
    component: 'Stack',
    children: [{
      id: 'unknown-node',
      component: 'UnknownComponent',
    }],
  }],
};

describe('repl.render preview messaging', () => {
  it('uses a ready summary for valid schemas', async () => {
    const result = await handle({ schema: VALID_SCHEMA });

    expect(result.status).toBe('ok');
    expect(result.preview?.summary).toBe('Render ready for 1 screen');
  });

  it('uses a blocked summary for invalid schemas', async () => {
    const result = await handle({ schema: INVALID_SCHEMA });

    expect(result.status).toBe('error');
    expect(result.preview?.summary).toBe('Render blocked: 1 validation error');
    expect(result.errors.some((issue) => issue.code === 'OODS-V006')).toBe(true);
  });
});

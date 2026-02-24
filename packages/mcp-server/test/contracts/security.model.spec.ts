import { describe, expect, it } from 'vitest';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import { handle as brandApplyHandle } from '../../src/tools/brand.apply.js';
import type { UiSchema } from '../../src/schemas/generated.js';

describe('security model', () => {
  it('blocks prototype pollution via JSON patch paths', async () => {
    expect(({} as any).polluted).toBeUndefined();

    const baseTree: UiSchema = {
      version: '2026.02',
      screens: [{ id: 'screen_home', component: 'Stack', children: [{ id: 'title', component: 'Text' }] }],
    };

    const result = await renderHandle({
      mode: 'patch',
      baseTree,
      patch: [{ op: 'add', path: '/__proto__/polluted', value: 'yes' }],
    });

    expect(result.status).toBe('error');
    expect(result.errors.some((err) => err.code === 'PATCH_UNSAFE_PATH')).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('blocks prototype pollution via node-targeted patch paths', async () => {
    expect(({} as any).polluted).toBeUndefined();

    const baseTree: UiSchema = {
      version: '2026.02',
      screens: [{ id: 'screen_home', component: 'Stack', children: [{ id: 'title', component: 'Text' }] }],
    };

    const result = await renderHandle({
      mode: 'patch',
      baseTree,
      patch: [{ nodeId: 'title', path: '__proto__.polluted', value: 'yes' }],
    });

    expect(result.status).toBe('error');
    expect(result.errors.some((err) => err.code === 'PATCH_UNSAFE_PATH')).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('rejects brand.apply deltas containing unsafe keys', async () => {
    expect(({} as any).polluted).toBeUndefined();

    const delta = Object.create(null);
    (delta as any)['__proto__'] = { polluted: true };

    await expect(
      brandApplyHandle({
        apply: false,
        brand: 'A',
        strategy: 'alias',
        delta: delta as any,
      })
    ).rejects.toThrow(/Unsafe key/i);

    expect(({} as any).polluted).toBeUndefined();
  });

  it('rejects brand.apply patch operations targeting unsafe paths', async () => {
    expect(({} as any).polluted).toBeUndefined();

    await expect(
      brandApplyHandle({
        apply: false,
        brand: 'A',
        delta: [{ op: 'add', path: '/__proto__/polluted', value: 'yes' }],
      } as any)
    ).rejects.toThrow(/Unsafe key|Invalid JSON pointer/i);

    expect(({} as any).polluted).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { handle as brandApplyHandle } from '../../src/tools/brand.apply.js';
import { handle as tokensBuildHandle } from '../../src/tools/tokens.build.js';

describe('preview compaction', () => {
  it('tokens.build preview returns a non-empty summary when apply=false', async () => {
    const result = await tokensBuildHandle({ brand: 'A', theme: 'dark', apply: false });

    expect(result.artifacts).toHaveLength(0);
    expect(result.preview?.summary).toBeTruthy();
    expect(result.preview?.notes?.length).toBeGreaterThan(0);
    expect(result.preview?.specimens?.length).toBeGreaterThan(0);
  });

  it('brand.apply compact preview omits structured payloads and specimens', async () => {
    const result = await brandApplyHandle({
      brand: 'A',
      strategy: 'alias',
      apply: false,
      preview: { verbosity: 'compact' },
      delta: { typography: { body: { fontSize: 15 } } },
    });

    expect(result.preview?.summary).toBeTruthy();
    expect(result.preview?.diffs?.length).toBeGreaterThan(0);
    for (const diff of result.preview?.diffs ?? []) {
      expect(diff.structured).toBeUndefined();
    }
    expect(result.preview?.specimens).toBeUndefined();
  });
});

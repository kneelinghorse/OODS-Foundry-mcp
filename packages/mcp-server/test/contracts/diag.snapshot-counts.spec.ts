import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { handle as catalogList } from '../../src/tools/catalog.list.js';
import { handle as diagSnapshot } from '../../src/tools/diag.snapshot.js';

describe('diag.snapshot inventory counts', () => {
  it('matches catalog.list component totals', async () => {
    const catalog = await catalogList({});
    const snapshot = await diagSnapshot({});

    expect(snapshot.diagnosticsPath).toBeDefined();

    const diagnosticsRaw = fs.readFileSync(snapshot.diagnosticsPath!, 'utf8');
    const diagnostics = JSON.parse(diagnosticsRaw) as { inventory?: { components?: number | null } };

    const catalogCount = catalog.stats?.componentCount ?? catalog.totalCount;
    expect(diagnostics.inventory?.components).toBe(catalogCount);
  });
});

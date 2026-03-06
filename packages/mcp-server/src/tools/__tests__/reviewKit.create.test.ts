import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPolicy, todayDir } from '../../lib/security.js';
import { handle as reviewKitHandle } from '../reviewKit.create.js';
import { handle as purityAuditHandle } from '../purity.audit.js';
import { handle as vrtRunHandle } from '../vrt.run.js';

describe('artifact bundle tools', () => {
  it.each([
    ['reviewKit.create', reviewKitHandle],
    ['purity.audit', purityAuditHandle],
    ['vrt.run', vrtRunHandle],
  ] as const)('creates missing parent directories on first apply run for %s', async (toolName, handler) => {
    const policy = loadPolicy();
    const outDir = path.join(todayDir(policy.artifactsBase), toolName);

    fs.rmSync(outDir, { recursive: true, force: true });

    const result = await handler({ apply: true });

    expect(result.artifacts).toHaveLength(1);
    expect(fs.existsSync(result.artifacts[0])).toBe(true);
    expect(fs.existsSync(result.transcriptPath)).toBe(true);
    expect(fs.existsSync(result.bundleIndexPath)).toBe(true);
  });
});

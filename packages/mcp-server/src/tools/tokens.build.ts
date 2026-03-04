import path from 'node:path';
import fs from 'node:fs';
import { todayDir, loadPolicy, withinAllowed } from '../lib/security.js';
import { writeTranscript, writeBundleIndex } from '../lib/transcript.js';
import type { TokensBuildInput, GenericOutput, ToolPreview } from './types.js';

export async function handle(input: TokensBuildInput = {}): Promise<GenericOutput> {
  const policy = loadPolicy();
  const base = todayDir(policy.artifactsBase);
  const outDir = path.join(base, 'tokens.build');
  const startedAt = new Date();
  const artifacts: string[] = [];
  let preview: ToolPreview | undefined;

  fs.mkdirSync(outDir, { recursive: true });

  const brand = input.brand ?? 'A';
  const theme = input.theme ?? 'dark';

  if (input.apply) {
    const file = path.join(outDir, `tokens.${theme}.json`);
    if (!withinAllowed(policy.artifactsBase, file)) {
      throw new Error('Path not allowed');
    }
    fs.writeFileSync(file, JSON.stringify({ brand, theme }, null, 2));
    artifacts.push(file);
  } else {
    const expected = [
      `tokens.${theme}.json`,
      'tokens.css',
      'tokens.ts',
      'tokens.tailwind.json',
    ];
    preview = {
      summary: `Preview only: would build ${expected.length} token artifact${expected.length === 1 ? '' : 's'} for brand ${brand} (${theme} theme).`,
      notes: expected.map((name) => `artifact: ${name}`),
      specimens: expected.map((name) => path.join(outDir, name)),
    };
  }

  const transcriptPath = writeTranscript(outDir, {
    tool: 'tokens.build',
    input,
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  });
  const bundleIndexPath = writeBundleIndex(outDir, [transcriptPath, ...artifacts]);
  return { artifacts, transcriptPath, bundleIndexPath, ...(preview ? { preview } : {}) };
}

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('s90 registration audit', () => {
  const requiredMentions: Array<{ label: string; file: string; patterns: string[] }> = [
    { label: 'registry.json', file: 'packages/mcp-server/src/tools/registry.json', patterns: ['"map.apply"', '"registry.snapshot"'] },
    { label: 'registry.ts', file: 'packages/mcp-server/src/tools/registry.ts', patterns: ["'map.apply'", "'registry.snapshot'"] },
    { label: 'policy.json', file: 'packages/mcp-server/src/security/policy.json', patterns: ['"tool": "map.apply"', '"tool": "registry.snapshot"'] },
    { label: 'generated.ts', file: 'packages/mcp-server/src/schemas/generated.ts', patterns: ['// Source: map.apply.input.json', '// Source: registry.snapshot.input.json'] },
    { label: 'tool-descriptions.json', file: 'packages/mcp-adapter/tool-descriptions.json', patterns: ['"map.apply"', '"registry.snapshot"'] },
    { label: 'mcp-bridge config', file: 'packages/mcp-bridge/src/config.ts', patterns: ["name: 'map.apply'", "name: 'registry.snapshot'"] },
    { label: 'server index', file: 'packages/mcp-server/src/index.ts', patterns: ["'map.apply': {", "'registry.snapshot': {"] },
    { label: 'error registry', file: 'packages/mcp-server/src/errors/registry.ts', patterns: ['OODS-V201', 'OODS-N014'] },
  ];

  for (const entry of requiredMentions) {
    it(`wires both tools into ${entry.label}`, () => {
      const source = read(entry.file);
      for (const pattern of entry.patterns) {
        expect(source).toContain(pattern);
      }
    });
  }
});

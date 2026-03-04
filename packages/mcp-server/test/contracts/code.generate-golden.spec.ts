import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handle as codegenHandle } from '../../src/tools/code.generate.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/ui');
const GOLDEN_DIR = path.resolve(__dirname, '../fixtures/codegen');

const FIXTURES = [
  {
    name: 'dashboard-page',
    schemaFile: 'dashboard-page.ui-schema.json',
    reactFile: 'dashboard-page.react.tsx',
    vueFile: 'dashboard-page.vue',
  },
  {
    name: 'form-page',
    schemaFile: 'form-page.ui-schema.json',
    reactFile: 'form-page.react.tsx',
    vueFile: 'form-page.vue',
  },
  {
    name: 'detail-page',
    schemaFile: 'detail-page.ui-schema.json',
    reactFile: 'detail-page.react.tsx',
    vueFile: 'detail-page.vue',
  },
];

const options = { styling: 'tokens', typescript: true } as const;

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').trimEnd();
}

function loadSchema(fileName: string): UiSchema {
  const schemaPath = path.join(FIXTURE_DIR, fileName);
  return JSON.parse(readFileSync(schemaPath, 'utf8')) as UiSchema;
}

function loadGolden(fileName: string): string {
  const filePath = path.join(GOLDEN_DIR, fileName);
  return normalize(readFileSync(filePath, 'utf8'));
}

describe('code.generate golden outputs', () => {
  for (const fixture of FIXTURES) {
    it(`matches React golden output for ${fixture.name}`, async () => {
      const schema = loadSchema(fixture.schemaFile);
      const result = await codegenHandle({ schema, framework: 'react', options });

      expect(result.status).toBe('ok');
      expect(result.fileExtension).toBe('.tsx');

      const expected = loadGolden(fixture.reactFile);
      expect(normalize(result.code)).toBe(expected);
    });

    it(`matches Vue golden output for ${fixture.name}`, async () => {
      const schema = loadSchema(fixture.schemaFile);
      const result = await codegenHandle({ schema, framework: 'vue', options });

      expect(result.status).toBe('ok');
      expect(result.fileExtension).toBe('.vue');

      const expected = loadGolden(fixture.vueFile);
      expect(normalize(result.code)).toBe(expected);
    });
  }
});

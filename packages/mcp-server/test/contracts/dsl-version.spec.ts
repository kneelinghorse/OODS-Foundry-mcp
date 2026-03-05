import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';

const SCHEMAS_DIR = path.resolve(import.meta.dirname, '../../src/schemas');

function readSchema(name: string): Record<string, unknown> {
  const filePath = path.join(SCHEMAS_DIR, name);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('dslVersion parameter', () => {
  const toolsWithDslVersion = [
    'design.compose.input.json',
    'repl.validate.input.json',
    'repl.render.input.json',
    'code.generate.input.json',
    'pipeline.input.json',
    'viz.compose.input.json',
  ];

  for (const schemaFile of toolsWithDslVersion) {
    it(`${schemaFile} includes dslVersion property`, () => {
      const schema = readSchema(schemaFile) as {
        properties?: Record<string, unknown>;
      };
      expect(schema.properties).toBeDefined();
      expect(schema.properties!.dslVersion).toBeDefined();
    });
  }

  it('health.input.json includes includeChangelog and sinceVersion', () => {
    const schema = readSchema('health.input.json') as {
      properties?: Record<string, unknown>;
    };
    expect(schema.properties).toBeDefined();
    expect(schema.properties!.includeChangelog).toBeDefined();
    expect(schema.properties!.sinceVersion).toBeDefined();
  });

  it('health.output.json includes dslVersion and changelog fields', () => {
    const schema = readSchema('health.output.json') as {
      properties?: Record<string, unknown>;
    };
    expect(schema.properties).toBeDefined();
    expect(schema.properties!.dslVersion).toBeDefined();
    expect(schema.properties!.changelog).toBeDefined();
  });
});

describe('deprecated_since field', () => {
  it('catalog.list.output.json includes deprecated_since in component items', () => {
    const schema = readSchema('catalog.list.output.json') as {
      properties?: {
        components?: {
          items?: {
            properties?: Record<string, unknown>;
          };
        };
      };
    };
    const itemProps = schema.properties?.components?.items?.properties;
    expect(itemProps).toBeDefined();
    expect(itemProps!.deprecated_since).toBeDefined();
  });
});

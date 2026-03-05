import { describe, expect, it } from 'vitest';
import { loadToolRegistry, resolveToolRegistry } from '../../src/tools/registry.js';
import { allCodes, getDefinition } from '../../src/errors/registry.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

describe('viz.compose contracts', () => {
  describe('tool registration', () => {
    it('is in the auto registry', () => {
      const registry = loadToolRegistry();
      expect(registry.auto).toContain('viz.compose');
    });

    it('is enabled by default', () => {
      const resolved = resolveToolRegistry({
        ...process.env,
        MCP_TOOLSET: 'default',
        MCP_EXTRA_TOOLS: '',
      });
      expect(resolved.enabled).toContain('viz.compose');
    });
  });

  describe('schemas', () => {
    it('input schema exists and is valid JSON', () => {
      const schemaPath = path.join(ROOT, 'src/schemas/viz.compose.input.json');
      const raw = fs.readFileSync(schemaPath, 'utf8');
      const schema = JSON.parse(raw);
      expect(schema.$id).toContain('viz.compose.input');
      expect(schema.type).toBe('object');
      expect(schema.anyOf).toHaveLength(3);
    });

    it('output schema exists and is valid JSON', () => {
      const schemaPath = path.join(ROOT, 'src/schemas/viz.compose.output.json');
      const raw = fs.readFileSync(schemaPath, 'utf8');
      const schema = JSON.parse(raw);
      expect(schema.$id).toContain('viz.compose.output');
      expect(schema.required).toContain('status');
      expect(schema.required).toContain('chartType');
      expect(schema.required).toContain('slots');
    });
  });

  describe('error codes', () => {
    it.each([
      ['OODS-V120', 'Invalid chart type'],
      ['OODS-V121', 'Missing viz traits'],
      ['OODS-V122', 'No viz mark traits on object'],
    ])('has registered %s: %s', (code, expectedMessage) => {
      const def = getDefinition(code);
      expect(def).toBeDefined();
      expect(def!.code).toBe(code);
      expect(def!.category).toBe('validation');
      expect(def!.message).toBe(expectedMessage);
      expect(def!.retryable).toBe(true);
    });
  });

  describe('policy', () => {
    it('has security policy entry', () => {
      const policyPath = path.join(ROOT, 'src/security/policy.json');
      const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
      const rule = policy.rules.find((r: any) => r.tool === 'viz.compose');
      expect(rule).toBeDefined();
      expect(rule.allow).toContain('designer');
      expect(rule.readOnly).toBe(true);
      expect(rule.ratePerMinute).toBe(60);
    });
  });

  describe('adapter', () => {
    it('has tool description', () => {
      const descPath = path.resolve(ROOT, '../../packages/mcp-adapter/tool-descriptions.json');
      if (!fs.existsSync(descPath)) return;
      const descriptions = JSON.parse(fs.readFileSync(descPath, 'utf8'));
      expect(descriptions['viz.compose']).toBeDefined();
      expect(descriptions['viz.compose']).toContain('visualization');
    });
  });

  describe('bridge', () => {
    it('has bridge policy fallback entry', () => {
      const configPath = path.resolve(ROOT, '../../packages/mcp-bridge/src/config.ts');
      if (!fs.existsSync(configPath)) return;
      const configSource = fs.readFileSync(configPath, 'utf8');
      expect(configSource).toContain("name: 'viz.compose'");
    });
  });
});

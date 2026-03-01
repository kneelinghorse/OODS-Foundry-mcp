import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseTrait } from '../../src/parsers/index.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';
import StatusableTraitModule from '../../traits/visual/Statusable.trait.ts';

const traitDir = join(__dirname, '..', '..', 'traits', 'visual');
const yamlPath = join(traitDir, 'Statusable.trait.yaml');

describe('Statusable trait', () => {
  it('parses YAML definition with domain-scoped status presentation', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('Statusable');
    expect(def.trait.version).toBe('1.0.0');
    expect(def.schema.status.type).toBe('string');
    expect(def.schema.domain.type).toBe('StatusDomain');
    expect(def.semantics?.status?.token_mapping).toBe('tokenMap(status.registry.*)');
    expect(def.view_extensions?.list?.[0]?.component).toBe('Badge');
  });

  it('exposes TypeScript definition with 6 tone token sets', () => {
    const def = StatusableTraitModule;

    expect(def.parameters?.[0]?.default).toEqual(['subscription']);
    expect(def.parameters?.[2]?.default).toBe('neutral');
    expect(def.metadata?.maturity).toBe('experimental');
    expect(def.tokens).toHaveProperty('cmp.status.neutral.surface');
    expect(def.tokens).toHaveProperty('cmp.status.critical.text');
    expect(def.tokens).toHaveProperty('cmp.banner.background');
  });

  it('accepts a subscription domain configuration', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Statusable', {
      domains: ['subscription'],
      defaultTone: 'neutral',
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('accepts multi-domain configuration', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Statusable', {
      domains: ['subscription', 'invoice', 'ticket'],
      toneAliases: { positive: 'success', danger: 'critical' },
      defaultTone: 'info',
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('rejects empty domains array', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Statusable', {
      domains: [],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('rejects invalid tone as defaultTone', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Statusable', {
      domains: ['subscription'],
      defaultTone: 'rainbow',
    });

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

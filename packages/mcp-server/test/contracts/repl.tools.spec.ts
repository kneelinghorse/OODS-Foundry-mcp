import { describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import validateInputSchema from '../../src/schemas/repl.validate.input.json' assert { type: 'json' };
import validateOutputSchema from '../../src/schemas/repl.validate.output.json' assert { type: 'json' };
import renderInputSchema from '../../src/schemas/repl.render.input.json' assert { type: 'json' };
import renderOutputSchema from '../../src/schemas/repl.render.output.json' assert { type: 'json' };
import { handle as validateHandle } from '../../src/tools/repl.validate.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import type { ReplValidateInput, UiSchema } from '../../src/schemas/generated.js';

const ajv = getAjv();
const validateValidateInput = ajv.compile<ReplValidateInput>(validateInputSchema);
const validateValidateOutput = ajv.compile(validateOutputSchema);
const validateRenderInput = ajv.compile(renderInputSchema);
const validateRenderOutput = ajv.compile(renderOutputSchema);

describe('Ajv schema registration', () => {
  it('preloads sibling schemas for repl.render/repl.validate refs', () => {
    for (const id of [
      'https://designlab.local/schemas/repl.render.input.json',
      'https://designlab.local/schemas/repl.validate.input.json',
      'https://designlab.local/schemas/repl.patch.json',
      'https://designlab.local/schemas/repl.ui.schema.json'
    ]) {
      expect(ajv.getSchema(id)).toBeTruthy();
    }
  });
});

const baseTree: UiSchema = {
  version: '2025.11',
  dsVersion: '2025-11-22',
  theme: 'default',
  screens: [
    {
      id: 'audit-screen',
      component: 'AuditTimeline',
      layout: { type: 'stack', gapToken: 'spacing.md' },
      meta: { label: 'Audit timeline' },
      children: [
        {
          id: 'archive-summary',
          component: 'ArchiveSummary',
          meta: { label: 'Archive summary' },
        },
      ],
    },
  ],
};

describe('Agentic REPL schemas', () => {
  it('accepts validate input payloads for full tree', () => {
    const payload: ReplValidateInput = { mode: 'full', schema: baseTree };
    expect(validateValidateInput(payload)).toBe(true);
    expect(validateValidateInput.errors).toBeNull();
  });

  it('accepts render input payloads for node patch application', () => {
    const payload = {
      mode: 'patch',
      baseTree,
      patch: [{ nodeId: 'archive-summary', path: 'component', value: 'ArchiveEvent' }],
    };
    expect(validateRenderInput(payload)).toBe(true);
    expect(validateRenderInput.errors).toBeNull();
  });
});

describe('Agentic REPL validate handler', () => {
  it('returns ok for valid DSL trees', async () => {
    const result = await validateHandle({ mode: 'full', schema: baseTree });

    expect(result.status).toBe('ok');
    expect(result.errors).toHaveLength(0);
    expect(result.meta?.screenCount).toBe(1);
    expect(validateValidateOutput(result)).toBe(true);
  });

  it('returns structured errors for unknown components', async () => {
    const invalidTree = structuredClone(baseTree);
    invalidTree.screens[0].children![0].component = 'UnknownComponent';

    const result = await validateHandle({ mode: 'full', schema: invalidTree });
    expect(result.status).toBe('invalid');
    expect(result.errors.some((err) => err.code === 'UNKNOWN_COMPONENT')).toBe(true);
    expect(validateValidateOutput(result)).toBe(true);
  });
});

describe('Agentic REPL render handler', () => {
  it('applies node patches and returns preview metadata', async () => {
    const result = await renderHandle({
      mode: 'patch',
      baseTree,
      patch: [{ nodeId: 'archive-summary', path: 'component', value: 'ArchiveEvent' }],
    });

    expect(result.status).toBe('ok');
    expect(result.renderedTree?.screens[0].children?.[0].component).toBe('ArchiveEvent');
    expect(result.appliedPatch).toBe(true);
    expect(result.preview?.screens).toContain('audit-screen');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('reports missing base tree when patching without context', async () => {
    const result = await renderHandle({
      mode: 'patch',
      patch: [{ nodeId: 'missing', path: 'component', value: 'ArchiveSummary' }],
    });

    expect(result.status).toBe('error');
    expect(result.errors.some((err) => err.code === 'MISSING_BASE_TREE')).toBe(true);
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('returns standalone html when apply=true and render is valid', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: baseTree,
      apply: true,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('<html');
    expect(result.html).toContain('<main id="oods-preview-root">');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('keeps dry-run output backward-compatible (no html field)', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: baseTree,
      apply: false,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toBeUndefined();
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('omits html when apply=true but validation fails', async () => {
    const invalidTree = structuredClone(baseTree);
    invalidTree.screens[0].children![0].component = 'UnknownComponent';

    const result = await renderHandle({
      mode: 'full',
      schema: invalidTree,
      apply: true,
    });

    expect(result.status).toBe('error');
    expect(result.html).toBeUndefined();
    expect(validateRenderOutput(result)).toBe(true);
  });
});

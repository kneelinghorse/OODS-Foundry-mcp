import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineInput, PipelineOutput } from '../pipeline.js';

// ── Mock dependent tool handlers ────────────────────────────────────

const mockComposeHandle = vi.fn();
const mockValidateHandle = vi.fn();
const mockRenderHandle = vi.fn();
const mockCodeGenerateHandle = vi.fn();
const mockSchemaSaveHandle = vi.fn();

vi.mock('../design.compose.js', () => ({
  handle: (...args: unknown[]) => mockComposeHandle(...args),
}));

vi.mock('../repl.validate.js', () => ({
  handle: (...args: unknown[]) => mockValidateHandle(...args),
}));

vi.mock('../repl.render.js', () => ({
  handle: (...args: unknown[]) => mockRenderHandle(...args),
}));

vi.mock('../code.generate.js', () => ({
  handle: (...args: unknown[]) => mockCodeGenerateHandle(...args),
}));

vi.mock('../schema/save.js', () => ({
  handle: (...args: unknown[]) => mockSchemaSaveHandle(...args),
}));

// ── Test fixtures ───────────────────────────────────────────────────

function composeOk() {
  return {
    status: 'ok',
    layout: 'detail',
    schemaRef: 'ref:test-schema-123',
    objectUsed: { name: 'Subscription' },
    schema: {
      version: '2026.03',
      screens: [
        {
          id: 'screen-root',
          component: 'Stack',
          children: [
            { id: 'btn-1', component: 'Button' },
            { id: 'text-1', component: 'Text' },
          ],
        },
      ],
    },
    errors: [],
    warnings: [],
  };
}

function validateOk() {
  return { status: 'ok', errors: [], warnings: [] };
}

function renderOk() {
  return {
    status: 'ok',
    html: '<div data-oods-component="Stack">...</div>',
    errors: [],
    warnings: [],
    output: { format: 'document', strict: false },
    meta: { validationMeta: {} },
  };
}

function codegenOk() {
  return {
    status: 'ok',
    framework: 'react',
    code: 'export function Page() { return <div />; }',
    fileExtension: '.tsx',
    imports: ['react'],
    warnings: [],
  };
}

function saveOk() {
  return { name: 'my-schema', version: 1 };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('pipeline orchestration', () => {
  let handle: (input: PipelineInput) => Promise<PipelineOutput>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default happy-path stubs
    mockComposeHandle.mockResolvedValue(composeOk());
    mockValidateHandle.mockResolvedValue(validateOk());
    mockRenderHandle.mockResolvedValue(renderOk());
    mockCodeGenerateHandle.mockResolvedValue(codegenOk());
    mockSchemaSaveHandle.mockResolvedValue(saveOk());

    // Dynamic import to get the mocked version
    const mod = await import('../pipeline.js');
    handle = mod.handle;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Full pipeline ───────────────────────────────────────────────

  describe('full pipeline flow', () => {
    it('runs compose → validate → render → codegen and returns all sections', async () => {
      const result = await handle({
        object: 'Subscription',
        context: 'detail',
        framework: 'react',
        styling: 'tailwind',
      });

      expect(result.error).toBeUndefined();
      expect(result.compose.object).toBe('Subscription');
      expect(result.compose.layout).toBe('detail');
      expect(result.compose.componentCount).toBeGreaterThan(0);
      expect(result.validation).toBeDefined();
      expect(result.validation!.status).toBe('ok');
      expect(result.render).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.code!.framework).toBe('react');
      expect(result.code!.styling).toBe('tailwind');
      expect(result.code!.output).toBeTruthy();
    });

    it('includes pipeline metadata with steps and duration', async () => {
      const result = await handle({
        object: 'Subscription',
        context: 'detail',
        framework: 'react',
      });

      expect(result.pipeline.steps).toEqual(['compose', 'validate', 'render', 'codegen']);
      expect(result.pipeline.duration).toBeGreaterThan(0);
    });

    it('defaults framework to react and styling to tokens', async () => {
      const result = await handle({ object: 'Subscription' });

      expect(mockCodeGenerateHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'react',
          options: expect.objectContaining({ styling: 'tokens' }),
        }),
      );
      expect(result.code!.framework).toBe('react');
      expect(result.code!.styling).toBe('tokens');
    });

    it('passes object, intent, context, layout to compose', async () => {
      await handle({
        object: 'User',
        intent: 'manage users',
        context: 'list',
        layout: 'dashboard',
      });

      expect(mockComposeHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          object: 'User',
          intent: 'manage users',
          context: 'list',
          layout: 'dashboard',
          options: { validate: false },
        }),
      );
    });
  });

  // ── Skip options ──────────────────────────────────────────────────

  describe('skip options', () => {
    it('skipValidation=true omits validation step', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        options: { skipValidation: true },
      });

      expect(mockValidateHandle).not.toHaveBeenCalled();
      expect(result.validation).toBeUndefined();
      expect(result.pipeline.steps).not.toContain('validate');
      expect(result.pipeline.steps).toContain('compose');
      expect(result.pipeline.steps).toContain('render');
      expect(result.pipeline.steps).toContain('codegen');
    });

    it('skipRender=true omits render step', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        options: { skipRender: true },
      });

      expect(mockRenderHandle).not.toHaveBeenCalled();
      expect(result.render).toBeUndefined();
      expect(result.pipeline.steps).not.toContain('render');
      expect(result.pipeline.steps).toContain('validate');
    });

    it('both skipValidation and skipRender omit both steps', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        options: { skipValidation: true, skipRender: true },
      });

      expect(mockValidateHandle).not.toHaveBeenCalled();
      expect(mockRenderHandle).not.toHaveBeenCalled();
      expect(result.pipeline.steps).toEqual(['compose', 'codegen']);
    });
  });

  // ── Save option ───────────────────────────────────────────────────

  describe('save option', () => {
    it('saves schema when save name is provided', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        save: 'my-schema',
      });

      expect(mockSchemaSaveHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'my-schema',
          schemaRef: 'ref:test-schema-123',
        }),
      );
      expect(result.saved).toEqual({ name: 'my-schema', version: 1 });
      expect(result.pipeline.steps).toContain('save');
    });

    it('does not save when save is not provided', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(mockSchemaSaveHandle).not.toHaveBeenCalled();
      expect(result.saved).toBeUndefined();
      expect(result.pipeline.steps).not.toContain('save');
    });

    it('trims whitespace-only save names', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        save: '   ',
      });

      // Empty after trim — should not save
      expect(mockSchemaSaveHandle).not.toHaveBeenCalled();
      expect(result.saved).toBeUndefined();
    });
  });

  // ── Error handling ────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns error with partial results when compose fails', async () => {
      mockComposeHandle.mockResolvedValue({
        status: 'error',
        layout: 'auto',
        errors: [{ code: 'OBJECT_NOT_FOUND', message: 'Object "FakeObj" not found' }],
        warnings: [],
      });

      const result = await handle({
        object: 'FakeObj',
        framework: 'react',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.step).toBe('compose');
      expect(result.error!.code).toBe('OBJECT_NOT_FOUND');
      expect(result.error!.message).toContain('FakeObj');
      // No downstream steps executed
      expect(mockValidateHandle).not.toHaveBeenCalled();
      expect(mockRenderHandle).not.toHaveBeenCalled();
      expect(mockCodeGenerateHandle).not.toHaveBeenCalled();
    });

    it('returns error when compose throws an exception', async () => {
      mockComposeHandle.mockRejectedValue(new Error('compose crashed'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.step).toBe('compose');
      expect(result.error!.code).toBe('OODS-S010');
      expect(result.error!.message).toContain('compose crashed');
    });

    it('returns error when validate fails', async () => {
      mockValidateHandle.mockResolvedValue({
        status: 'invalid',
        errors: [{ code: 'INVALID_SCHEMA', message: 'Schema structure invalid' }],
        warnings: [],
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.step).toBe('validate');
      expect(result.error!.code).toBe('INVALID_SCHEMA');
      // compose ran but validation failed — no render/codegen
      expect(mockRenderHandle).not.toHaveBeenCalled();
      expect(mockCodeGenerateHandle).not.toHaveBeenCalled();
    });

    it('returns error when validate throws', async () => {
      mockValidateHandle.mockRejectedValue(new Error('validate exploded'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error!.step).toBe('validate');
      expect(result.error!.code).toBe('OODS-S011');
    });

    it('returns error when render fails', async () => {
      mockRenderHandle.mockResolvedValue({
        status: 'error',
        errors: [{ code: 'RENDER_FAILED', message: 'Cannot render component X' }],
        warnings: [],
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.step).toBe('render');
      expect(result.error!.code).toBe('RENDER_FAILED');
      expect(mockCodeGenerateHandle).not.toHaveBeenCalled();
    });

    it('returns error when render throws', async () => {
      mockRenderHandle.mockRejectedValue(new Error('render boom'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error!.step).toBe('render');
      expect(result.error!.code).toBe('OODS-S012');
    });

    it('returns error when codegen fails', async () => {
      mockCodeGenerateHandle.mockResolvedValue({
        status: 'error',
        framework: 'react',
        code: '',
        fileExtension: '',
        imports: [],
        warnings: [],
        errors: [{ code: 'EMITTER_CRASH', message: 'React emitter failed' }],
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error!.step).toBe('codegen');
      expect(result.error!.code).toBe('EMITTER_CRASH');
    });

    it('returns error when codegen throws', async () => {
      mockCodeGenerateHandle.mockRejectedValue(new Error('codegen kaboom'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error!.step).toBe('codegen');
      expect(result.error!.code).toBe('OODS-S013');
    });

    it('returns error when save throws', async () => {
      mockSchemaSaveHandle.mockRejectedValue(new Error('disk full'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        save: 'test-save',
      });

      expect(result.error!.step).toBe('save');
      expect(result.error!.code).toBe('OODS-S014');
      // Code was generated before save failed
      expect(result.code).toBeDefined();
    });

    it('returns SCHEMA_REF_MISSING when compose returns no schemaRef', async () => {
      mockComposeHandle.mockResolvedValue({
        ...composeOk(),
        schemaRef: undefined,
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error!.step).toBe('compose');
      expect(result.error!.code).toBe('OODS-C001');
    });

    it('always includes pipeline duration even on error', async () => {
      mockComposeHandle.mockRejectedValue(new Error('fail early'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.pipeline.duration).toBeGreaterThan(0);
      expect(result.pipeline.steps).toContain('compose');
    });
  });

  // ── Duration tracking ─────────────────────────────────────────────

  describe('duration and steps tracking', () => {
    it('pipeline.duration is always a positive number', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.pipeline.duration).toBeGreaterThan(0);
      expect(typeof result.pipeline.duration).toBe('number');
    });

    it('pipeline.steps lists all executed steps in order', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        save: 'test-schema',
      });

      expect(result.pipeline.steps).toEqual(['compose', 'validate', 'render', 'codegen', 'save']);
    });

    it('pipeline.steps reflects skipped steps', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        options: { skipValidation: true, skipRender: true },
      });

      expect(result.pipeline.steps).toEqual(['compose', 'codegen']);
    });
  });

  // ── schemaRef propagation ─────────────────────────────────────────

  describe('schemaRef propagation', () => {
    it('propagates compose schemaRef to output', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.schemaRef).toBe('ref:test-schema-123');
    });

    it('passes schemaRef to validate', async () => {
      await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(mockValidateHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaRef: 'ref:test-schema-123',
        }),
      );
    });

    it('passes schemaRef to render', async () => {
      await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(mockRenderHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaRef: 'ref:test-schema-123',
        }),
      );
    });

    it('passes schemaRef to codegen', async () => {
      await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(mockCodeGenerateHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaRef: 'ref:test-schema-123',
        }),
      );
    });

    it('passes schemaRef to save', async () => {
      await handle({
        object: 'Subscription',
        framework: 'react',
        save: 'test-save',
      });

      expect(mockSchemaSaveHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaRef: 'ref:test-schema-123',
        }),
      );
    });
  });

  // ── Component count ───────────────────────────────────────────────

  describe('component counting', () => {
    it('counts unique components from compose result', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      // Fixture has Stack, Button, Text = 3 unique
      expect(result.compose.componentCount).toBe(3);
    });
  });
});

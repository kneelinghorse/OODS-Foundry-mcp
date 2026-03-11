import { describe, expect, it } from 'vitest';
import { handle } from '../../src/tools/viz.compose.js';
import { handle as validateHandle } from '../../src/tools/repl.validate.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import { handle as codeGenerateHandle } from '../../src/tools/code.generate.js';

describe('viz.compose handler', () => {
  describe('chartType input mode', () => {
    it.each(['bar', 'line', 'area', 'point', 'scatter', 'heatmap'] as const)(
      'composes %s chart from explicit chartType',
      async (chartType) => {
        const result = await handle({ chartType, dataBindings: { x: 'date', y: 'value' } });
        expect(result.status).toBe('ok');
        expect(result.chartType).toBe(chartType);
        expect(result.schemaRef).toBeDefined();
        expect(result.slots.length).toBeGreaterThanOrEqual(2);
      },
    );

    it('returns error for invalid chartType', async () => {
      const result = await handle({ chartType: 'pie' as any });
      expect(result.status).toBe('error');
      expect(result.errors?.[0]?.code).toBe('OODS-V120');
    });
  });

  describe('traits input mode', () => {
    it('resolves chart type from mark trait', async () => {
      const result = await handle({ traits: ['mark-line'] });
      expect(result.status).toBe('ok');
      expect(result.chartType).toBe('line');
    });

    it('resolves chart type from PascalCase trait', async () => {
      const result = await handle({ traits: ['MarkArea'] });
      expect(result.status).toBe('ok');
      expect(result.chartType).toBe('area');
    });

    it('defaults to bar when traits have no mark', async () => {
      const result = await handle({ traits: ['encoding-position-x'] });
      expect(result.status).toBe('ok');
      expect(result.chartType).toBe('bar');
    });
  });

  describe('error handling', () => {
    it('returns error when no input provided', async () => {
      // At least one of chartType, object, or traits is required by schema
      // But the handler also validates internally
      const result = await handle({} as any);
      expect(result.status).toBe('error');
      expect(result.errors?.[0]?.code).toBe('OODS-V121');
    });

    it('returns error for unknown object', async () => {
      const result = await handle({ object: 'NonExistentVizObject' });
      expect(result.status).toBe('error');
      expect(result.errors?.[0]?.code).toBe('OODS-S004');
    });
  });

  describe('slot placement', () => {
    it('places chart-area and controls-panel for any chart', async () => {
      const result = await handle({ chartType: 'bar' });
      const slotNames = result.slots.map((s) => s.slotName);
      expect(slotNames).toContain('chart-area');
      expect(slotNames).toContain('controls-panel');
    });

    it('places correct preview component for bar', async () => {
      const result = await handle({ chartType: 'bar' });
      const chartArea = result.slots.find((s) => s.slotName === 'chart-area');
      expect(chartArea?.component).toBe('VizMarkPreview');
    });

    it('places correct preview component for line', async () => {
      const result = await handle({ chartType: 'line' });
      const chartArea = result.slots.find((s) => s.slotName === 'chart-area');
      expect(chartArea?.component).toBe('VizLinePreview');
    });

    it('places correct preview component for area', async () => {
      const result = await handle({ chartType: 'area' });
      const chartArea = result.slots.find((s) => s.slotName === 'chart-area');
      expect(chartArea?.component).toBe('VizAreaPreview');
    });

    it('places correct preview component for point', async () => {
      const result = await handle({ chartType: 'point' });
      const chartArea = result.slots.find((s) => s.slotName === 'chart-area');
      expect(chartArea?.component).toBe('VizPointPreview');
    });

    it('places correct preview component for scatter', async () => {
      const result = await handle({ chartType: 'scatter' });
      const chartArea = result.slots.find((s) => s.slotName === 'chart-area');
      expect(chartArea?.component).toBe('VizScatterPreview');
    });

    it('places correct preview component for heatmap', async () => {
      const result = await handle({ chartType: 'heatmap' });
      const chartArea = result.slots.find((s) => s.slotName === 'chart-area');
      expect(chartArea?.component).toBe('VizHeatmapPreview');
    });

    it('always places VizRoleBadge', async () => {
      const result = await handle({ chartType: 'bar' });
      const roleBadge = result.slots.find((s) => s.slotName === 'role-badge');
      expect(roleBadge?.component).toBe('VizRoleBadge');
    });
  });

  describe('encoding-driven slots', () => {
    it('places axis controls and summary when encoding traits present', async () => {
      const result = await handle({
        traits: ['mark-bar', 'encoding-position-x', 'encoding-position-y'],
        dataBindings: { x: 'category', y: 'amount' },
      });
      const slotNames = result.slots.map((s) => s.slotName);
      expect(slotNames).toContain('axis-config');
      expect(slotNames).toContain('axis-summary');
    });

    it('places encoding badges for x and y', async () => {
      const result = await handle({
        traits: ['mark-bar', 'encoding-position-x', 'encoding-position-y'],
        dataBindings: { x: 'date', y: 'revenue' },
      });
      const slotNames = result.slots.map((s) => s.slotName);
      expect(slotNames).toContain('encoding-badge-x');
      expect(slotNames).toContain('encoding-badge-y');
    });

    it('places color controls and legend for color encoding', async () => {
      const result = await handle({
        traits: ['mark-bar', 'encoding-color'],
        dataBindings: { color: 'region' },
      });
      const slotNames = result.slots.map((s) => s.slotName);
      expect(slotNames).toContain('color-config');
      expect(slotNames).toContain('legend');
    });

    it('places size controls for size encoding', async () => {
      const result = await handle({
        traits: ['mark-point', 'encoding-size'],
        dataBindings: { size: 'population' },
      });
      const slotNames = result.slots.map((s) => s.slotName);
      expect(slotNames).toContain('size-config');
      expect(slotNames).toContain('size-summary');
    });

    it('places opacity controls for opacity encoding', async () => {
      const result = await handle({
        traits: ['mark-scatter', 'encoding-opacity'],
        dataBindings: { opacity: 'confidence' },
      });
      const slotNames = result.slots.map((s) => s.slotName);
      expect(slotNames).toContain('opacity-config');
      expect(slotNames).toContain('opacity-summary');
    });

    it('places shape legend for shape encoding', async () => {
      const result = await handle({
        traits: ['mark-scatter', 'encoding-shape'],
        dataBindings: { shape: 'category' },
      });
      const slotNames = result.slots.map((s) => s.slotName);
      expect(slotNames).toContain('shape-config');
      expect(slotNames).toContain('shape-legend');
    });
  });

  describe('scale and interaction slots', () => {
    it('places scale controls for scale traits', async () => {
      const result = await handle({
        traits: ['mark-bar', 'scale-linear'],
      });
      const slotNames = result.slots.map((s) => s.slotName);
      expect(slotNames).toContain('scale-linear-controls');
      expect(slotNames).toContain('scale-linear-summary');
    });

    it('places interaction slot for tooltip trait', async () => {
      const result = await handle({
        traits: ['mark-bar', 'interaction-tooltip'],
      });
      const slotNames = result.slots.map((s) => s.slotName);
      expect(slotNames).toContain('interaction-tooltip');
    });

    it('places interaction slot for highlight trait', async () => {
      const result = await handle({
        traits: ['mark-line', 'interaction-highlight'],
      });
      const slotNames = result.slots.map((s) => s.slotName);
      expect(slotNames).toContain('interaction-highlight');
    });
  });

  describe('data binding props', () => {
    it('wires dataBindings to chart component props', async () => {
      const result = await handle({
        chartType: 'bar',
        dataBindings: { x: 'month', y: 'revenue', color: 'region', size: 'count' },
      });
      const chartArea = result.slots.find((s) => s.slotName === 'chart-area');
      expect(chartArea?.props.xField).toBe('month');
      expect(chartArea?.props.yField).toBe('revenue');
      expect(chartArea?.props.colorField).toBe('region');
      expect(chartArea?.props.sizeField).toBe('count');
    });

    it('wires opacity and shape dataBindings to chart component props', async () => {
      const result = await handle({
        chartType: 'scatter',
        dataBindings: { x: 'age', y: 'income', opacity: 'confidence', shape: 'category' },
      });
      const chartArea = result.slots.find((s) => s.slotName === 'chart-area');
      expect(chartArea?.props.opacityField).toBe('confidence');
      expect(chartArea?.props.shapeField).toBe('category');
    });
  });

  describe('schema output', () => {
    it('produces valid UiSchema with version', async () => {
      const result = await handle({ chartType: 'bar' });
      expect(result.schema.version).toBe('2026.02');
      expect(result.schema.screens).toHaveLength(1);
      expect(result.schema.screens[0].component).toBe('Stack');
    });

    it('includes layout data attributes', async () => {
      const result = await handle({ chartType: 'line' });
      expect(result.schema.screens[0].props?.['data-layout']).toBe('viz');
      expect(result.schema.screens[0].props?.['data-chart-type']).toBe('line');
    });

    it('includes viz-layout attribute for layout traits', async () => {
      const result = await handle({ traits: ['mark-bar', 'layout-layer'] });
      expect(result.schema.screens[0].props?.['data-viz-layout']).toBe('layer');
    });

    it('includes objectSchema for codegen typed props', async () => {
      const result = await handle({
        chartType: 'bar',
        dataBindings: { x: 'date', y: 'amount' },
      });
      expect(result.schema.objectSchema).toBeDefined();
      expect(result.schema.objectSchema?.x_field).toEqual({
        type: 'string',
        required: true,
        description: expect.stringContaining('date'),
      });
      expect(result.schema.objectSchema?.data).toEqual({
        type: 'array',
        required: true,
        description: expect.any(String),
      });
    });

    it('creates schemaRef for pipeline reuse', async () => {
      const result = await handle({ chartType: 'bar' });
      expect(result.schemaRef).toMatch(/^viz\.compose[-:]/);
      expect(result.schemaRefCreatedAt).toBeDefined();
      expect(result.schemaRefExpiresAt).toBeDefined();
    });

    it('manual viz output validates against the live registry', async () => {
      const result = await handle({
        chartType: 'bar',
        dataBindings: { x: 'date', y: 'revenue' },
      });
      const validation = await validateHandle({
        mode: 'full',
        schema: result.schema,
        options: { checkComponents: true },
      });

      expect(validation.status).toBe('ok');
      expect(validation.errors).toHaveLength(0);
    });

    it('object-backed viz output validates against the live registry', async () => {
      const result = await handle({ object: 'Subscription' });
      const validation = await validateHandle({
        mode: 'full',
        schema: result.schema,
        options: { checkComponents: true },
      });

      expect(validation.status).toBe('ok');
      expect(validation.errors).toHaveLength(0);
    });

    it('render and code.generate accept the viz schema without unknown-component warnings', async () => {
      const result = await handle({
        chartType: 'bar',
        dataBindings: { x: 'month', y: 'revenue' },
      });
      const renderResult = await renderHandle({
        mode: 'full',
        schema: result.schema,
        apply: true,
        output: { format: 'document' },
      });
      const codegen = await codeGenerateHandle({
        schema: result.schema,
        framework: 'react',
      });

      expect(renderResult.status).toBe('ok');
      expect(codegen.status).toBe('ok');
      expect(codegen.warnings.some((warning) => warning.code === 'OODS-V119')).toBe(false);
    });
  });

  describe('meta output', () => {
    it('reports layout strategy in meta', async () => {
      const result = await handle({ traits: ['mark-bar', 'layout-facet'] });
      expect(result.meta?.layoutStrategy).toBe('facet');
    });

    it('reports scales in meta', async () => {
      const result = await handle({ traits: ['mark-bar', 'scale-temporal'] });
      expect(result.meta?.scalesResolved).toContain('scale-temporal');
    });

    it('reports interactions in meta', async () => {
      const result = await handle({ traits: ['mark-bar', 'interaction-tooltip'] });
      expect(result.meta?.interactionsResolved).toContain('interaction-tooltip');
    });

    it('reports component count', async () => {
      const result = await handle({ chartType: 'bar' });
      expect(result.meta?.componentCount).toBeGreaterThanOrEqual(2);
    });
  });
});

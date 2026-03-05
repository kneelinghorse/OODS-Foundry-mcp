/**
 * viz.compose MCP tool handler.
 *
 * Composes a visualization schema from chart type, data bindings,
 * and/or object viz traits. Produces a component tree with slots
 * for chart-area, controls-panel, axis-config, color-config, legend,
 * plus interaction and layout components.
 *
 * Processing:
 *   1. Resolve chart type (from explicit chartType or object viz traits)
 *   2. Resolve all viz trait categories (encoding, layout, scale, interaction)
 *   3. Map mark traits → chart components
 *   4. Wire viz components into slots
 *   5. Apply viz semantic tokens
 *   6. Return vizSchema + slots + resolution metadata
 */
import type { UiSchema } from '../schemas/generated.js';
import { createSchemaRef, describeSchemaRef } from './schema-ref.js';
import { loadObject } from '../objects/object-loader.js';
import { composeObject } from '../objects/trait-composer.js';
import {
  resolveVizTraits,
  applyScalesToEncodings,
  type VizTraitResolution,
} from '../compose/viz-trait-resolver.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ChartType = 'bar' | 'line' | 'area' | 'point';

export interface DataBindings {
  x?: string;
  y?: string;
  color?: string;
  size?: string;
}

export interface VizComposeInput {
  object?: string;
  traits?: string[];
  chartType?: ChartType;
  dataBindings?: DataBindings;
  theme?: string;
  options?: {
    validate?: boolean;
  };
}

export interface VizSlotEntry {
  slotName: string;
  component: string;
  props: Record<string, unknown>;
}

export interface VizIssue {
  code: string;
  message: string;
  path?: string;
  hint?: string;
}

export interface VizComposeOutput {
  status: 'ok' | 'error';
  chartType: string;
  schema: UiSchema;
  schemaRef?: string;
  schemaRefCreatedAt?: string;
  schemaRefExpiresAt?: string;
  slots: VizSlotEntry[];
  warnings: VizIssue[];
  errors?: VizIssue[];
  meta?: {
    traitsResolved: string[];
    encodingsApplied: string[];
    componentCount: number;
    objectUsed?: string;
    layoutStrategy?: string;
    scalesResolved?: string[];
    interactionsResolved?: string[];
  };
}

/* ------------------------------------------------------------------ */
/*  Chart type mapping                                                 */
/* ------------------------------------------------------------------ */

const CHART_COMPONENTS: Record<ChartType, { controls: string; preview: string }> = {
  bar: { controls: 'VizMarkControls', preview: 'VizMarkPreview' },
  line: { controls: 'VizLineControls', preview: 'VizLinePreview' },
  area: { controls: 'VizAreaControls', preview: 'VizAreaPreview' },
  point: { controls: 'VizPointControls', preview: 'VizPointPreview' },
};

const VALID_CHART_TYPES = new Set<string>(['bar', 'line', 'area', 'point']);

/* ------------------------------------------------------------------ */
/*  Schema building                                                    */
/* ------------------------------------------------------------------ */

let nodeCounter = 0;
function nextId(): string {
  return `viz-${++nodeCounter}`;
}

function resetNodeCounter(): void {
  nodeCounter = 0;
}

function buildVizSchema(
  chartType: ChartType,
  dataBindings: DataBindings,
  resolution: VizTraitResolution,
  theme?: string,
  tokenOverrides?: Record<string, unknown>,
): { schema: UiSchema; slots: VizSlotEntry[] } {
  const components = CHART_COMPONENTS[chartType];
  const slots: VizSlotEntry[] = [];

  const previewProps: Record<string, unknown> = {};
  if (dataBindings.x) previewProps.xField = dataBindings.x;
  if (dataBindings.y) previewProps.yField = dataBindings.y;
  if (dataBindings.color) previewProps.colorField = dataBindings.color;
  if (dataBindings.size) previewProps.sizeField = dataBindings.size;

  const controlsProps: Record<string, unknown> = { ...previewProps };

  // Core chart slots
  slots.push(
    { slotName: 'chart-area', component: components.preview, props: previewProps },
    { slotName: 'controls-panel', component: components.controls, props: controlsProps },
  );

  // Encoding-driven slots
  const xEnc = resolution.encodings.find((e) => e.channel === 'x');
  const yEnc = resolution.encodings.find((e) => e.channel === 'y');
  const colorEnc = resolution.encodings.find((e) => e.channel === 'color');
  const sizeEnc = resolution.encodings.find((e) => e.channel === 'size');

  if (xEnc || yEnc) {
    // Axis controls (form context)
    slots.push({
      slotName: 'axis-config',
      component: 'VizAxisControls',
      props: {
        ...(dataBindings.x ? { xField: dataBindings.x } : {}),
        ...(dataBindings.y ? { yField: dataBindings.y } : {}),
        ...(xEnc ? { xScale: xEnc.defaultScale } : {}),
        ...(yEnc ? { yScale: yEnc.defaultScale } : {}),
      },
    });
    // Axis summary (detail context)
    slots.push({
      slotName: 'axis-summary',
      component: 'VizAxisSummary',
      props: {
        ...(xEnc ? { axis: 'x', xScale: xEnc.defaultScale, axisTitle: xEnc.axisTitle } : {}),
        ...(yEnc ? { axis: 'y', yScale: yEnc.defaultScale, axisTitle: yEnc.axisTitle } : {}),
      },
    });
    // Encoding badges (list context)
    if (xEnc) {
      slots.push({
        slotName: 'encoding-badge-x',
        component: 'VizEncodingBadge',
        props: { axis: 'x', ...(dataBindings.x ? { fieldField: dataBindings.x } : {}) },
      });
    }
    if (yEnc) {
      slots.push({
        slotName: 'encoding-badge-y',
        component: 'VizEncodingBadge',
        props: { axis: 'y', ...(dataBindings.y ? { fieldField: dataBindings.y } : {}) },
      });
    }
  }

  if (colorEnc) {
    slots.push(
      { slotName: 'color-config', component: 'VizColorControls', props: { colorField: dataBindings.color } },
      { slotName: 'legend', component: 'VizColorLegendConfig', props: { colorField: dataBindings.color } },
    );
  }

  if (sizeEnc) {
    slots.push(
      { slotName: 'size-config', component: 'VizSizeControls', props: { sizeField: dataBindings.size } },
      { slotName: 'size-summary', component: 'VizSizeSummary', props: { sizeField: dataBindings.size } },
    );
  }

  // Role badge (list context — always placed for mark identification)
  slots.push({
    slotName: 'role-badge',
    component: 'VizRoleBadge',
    props: { labelField: chartType },
  });

  // Scale-driven slots
  for (const scale of resolution.scales) {
    slots.push(
      {
        slotName: `scale-${scale.type}-controls`,
        component: 'VizScaleControls',
        props: { scaleType: scale.type },
      },
      {
        slotName: `scale-${scale.type}-summary`,
        component: 'VizScaleSummary',
        props: { scaleType: scale.type },
      },
    );
  }

  // Interaction-driven slots
  for (const interaction of resolution.interactions) {
    slots.push({
      slotName: `interaction-${interaction.type}`,
      component: interaction.component,
      props: { type: interaction.type },
    });
  }

  // Layout wrapper props
  const layoutProps: Record<string, unknown> = {
    'data-layout': 'viz',
    'data-chart-type': chartType,
  };
  if (resolution.layout.strategy !== 'single') {
    layoutProps['data-viz-layout'] = resolution.layout.strategy;
  }
  if (theme) {
    layoutProps['data-theme'] = theme;
  }

  const children = slots.map((slot) => ({
    id: nextId(),
    component: slot.component,
    props: {
      ...slot.props,
      'data-slot': slot.slotName,
      ...(theme ? { 'data-theme': theme } : {}),
    },
  }));

  // Build objectSchema for codegen typed props interface
  const objectSchema: Record<string, { type: string; required: boolean; description?: string }> = {};
  if (dataBindings.x) {
    objectSchema.x_field = { type: 'string', required: true, description: `X-axis data field: ${dataBindings.x}` };
  }
  if (dataBindings.y) {
    objectSchema.y_field = { type: 'string', required: true, description: `Y-axis data field: ${dataBindings.y}` };
  }
  if (dataBindings.color) {
    objectSchema.color_field = { type: 'string', required: false, description: `Color encoding field: ${dataBindings.color}` };
  }
  if (dataBindings.size) {
    objectSchema.size_field = { type: 'string', required: false, description: `Size encoding field: ${dataBindings.size}` };
  }
  objectSchema.data = { type: 'array', required: true, description: 'Data array for chart visualization' };

  const schema: UiSchema = {
    version: '2026.02',
    ...(Object.keys(tokenOverrides ?? {}).length > 0 ? { tokenOverrides: tokenOverrides as Record<string, string> } : {}),
    ...(Object.keys(objectSchema).length > 0 ? { objectSchema } : {}),
    screens: [
      {
        id: nextId(),
        component: 'Box',
        props: layoutProps,
        children,
      },
    ],
  };

  return { schema, slots };
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

export async function handle(input: VizComposeInput): Promise<VizComposeOutput> {
  resetNodeCounter();

  const warnings: VizIssue[] = [];
  const errors: VizIssue[] = [];
  let resolvedChartType: ChartType | null = input.chartType ?? null;
  let objectUsed: string | undefined;
  let vizTokens: Record<string, unknown> = {};
  let resolution: VizTraitResolution = {
    chartType: null,
    markTraits: [],
    encodings: [],
    layout: { strategy: 'single' },
    scales: [],
    interactions: [],
    allResolved: [],
    unrecognized: [],
  };

  // Validate chartType if provided directly
  if (input.chartType && !VALID_CHART_TYPES.has(input.chartType)) {
    return {
      status: 'error',
      chartType: input.chartType,
      schema: { version: '2026.02', screens: [{ id: 'err-0', component: 'Box' }] },
      slots: [],
      warnings: [],
      errors: [{
        code: 'OODS-V120',
        message: `Invalid chart type: "${input.chartType}". Must be one of: bar, line, area, point.`,
        hint: 'Use chartType: "bar" | "line" | "area" | "point".',
      }],
    };
  }

  // Resolve from object if provided
  if (input.object) {
    try {
      const objectDef = loadObject(input.object);
      objectUsed = input.object;
      const composed = composeObject(objectDef);
      const objectTraitNames = (composed.traits ?? []).map((t) => t.ref.name);

      resolution = applyScalesToEncodings(resolveVizTraits(objectTraitNames));

      // Collect viz semantic tokens from composed object
      const vizTokenEntries = Object.entries(composed.tokens ?? {}).filter(
        ([key]) => key.startsWith('viz.'),
      );
      if (vizTokenEntries.length > 0) {
        vizTokens = Object.fromEntries(vizTokenEntries);
      }

      if (!resolvedChartType && resolution.chartType) {
        resolvedChartType = resolution.chartType;
      }

      if (!resolvedChartType) {
        warnings.push({
          code: 'OODS-V122',
          message: `Object "${input.object}" has no viz mark traits. Falling back to bar chart.`,
          hint: 'Add mark-bar, mark-line, mark-area, or mark-point traits to the object.',
        });
        resolvedChartType = 'bar';
      }
    } catch (e) {
      return {
        status: 'error',
        chartType: '',
        schema: { version: '2026.02', screens: [{ id: 'err-0', component: 'Box' }] },
        slots: [],
        warnings: [],
        errors: [{
          code: 'OODS-S004',
          message: `Failed to load object "${input.object}": ${(e as Error).message}`,
          hint: 'Check the object name or verify objects/ directory.',
        }],
      };
    }
  }

  // Resolve from explicit traits
  if (input.traits && input.traits.length > 0) {
    const explicitResolution = applyScalesToEncodings(resolveVizTraits(input.traits));

    if (!resolvedChartType && explicitResolution.chartType) {
      resolvedChartType = explicitResolution.chartType;
    }

    // Merge explicit trait resolution with object resolution
    resolution = mergeResolutions(resolution, explicitResolution);
  }

  // Final fallback
  if (!resolvedChartType) {
    if (!input.chartType && !input.object && (!input.traits || input.traits.length === 0)) {
      return {
        status: 'error',
        chartType: '',
        schema: { version: '2026.02', screens: [{ id: 'err-0', component: 'Box' }] },
        slots: [],
        warnings: [],
        errors: [{
          code: 'OODS-V121',
          message: 'No chart type could be determined. Provide chartType, object, or traits.',
          hint: 'Example: { chartType: "bar", dataBindings: { x: "date", y: "revenue" } }',
        }],
      };
    }
    resolvedChartType = 'bar';
  }

  const dataBindings: DataBindings = input.dataBindings ?? {};

  // Build the viz schema with full trait resolution
  const { schema, slots } = buildVizSchema(resolvedChartType, dataBindings, resolution, input.theme, vizTokens);

  // Create schemaRef for pipeline reuse
  const record = createSchemaRef(schema, 'viz.compose');
  const refInfo = describeSchemaRef(record);

  return {
    status: 'ok',
    chartType: resolvedChartType,
    schema,
    schemaRef: refInfo.ref,
    schemaRefCreatedAt: refInfo.createdAt,
    schemaRefExpiresAt: refInfo.expiresAt,
    slots,
    warnings,
    ...(errors.length > 0 ? { errors } : {}),
    meta: {
      traitsResolved: resolution.allResolved,
      encodingsApplied: resolution.encodings.map((e) => e.traitName),
      componentCount: slots.length,
      ...(objectUsed ? { objectUsed } : {}),
      layoutStrategy: resolution.layout.strategy,
      scalesResolved: resolution.scales.map((s) => s.traitName),
      interactionsResolved: resolution.interactions.map((i) => i.traitName),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mergeResolutions(base: VizTraitResolution, overlay: VizTraitResolution): VizTraitResolution {
  return {
    chartType: base.chartType ?? overlay.chartType,
    markTraits: [...base.markTraits, ...overlay.markTraits],
    encodings: dedupeBy([...base.encodings, ...overlay.encodings], (e) => e.channel),
    layout: overlay.layout.strategy !== 'single' ? overlay.layout : base.layout,
    scales: dedupeBy([...base.scales, ...overlay.scales], (s) => s.type),
    interactions: dedupeBy([...base.interactions, ...overlay.interactions], (i) => i.type),
    allResolved: [...new Set([...base.allResolved, ...overlay.allResolved])],
    unrecognized: [...new Set([...base.unrecognized, ...overlay.unrecognized])],
  };
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

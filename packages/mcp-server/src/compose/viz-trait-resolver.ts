/**
 * Viz Trait Resolution Engine
 *
 * Resolves viz trait names (from objects or explicit input) into structured
 * configuration for chart composition. Handles all 15 viz trait categories:
 *   - Mark traits (4): bar, line, area, point → chart type
 *   - Encoding traits (4): position-x, position-y, color, size → axis/scale config
 *   - Layout traits (3): layer, facet, concat → composition strategy
 *   - Scale traits (2): linear, temporal → scale type config
 *   - Interaction traits (2): tooltip, highlight → interaction components
 */

import type { ChartType } from '../tools/viz.compose.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ScaleType = 'linear' | 'temporal';
export type LayoutStrategy = 'layer' | 'facet' | 'concat' | 'single';

export interface EncodingConfig {
  channel: 'x' | 'y' | 'color' | 'size';
  traitName: string;
  defaultScale: ScaleType;
  axisTitle?: string;
}

export interface LayoutConfig {
  strategy: LayoutStrategy;
  traitName?: string;
}

export interface ScaleConfig {
  type: ScaleType;
  traitName: string;
}

export interface InteractionConfig {
  type: 'tooltip' | 'highlight';
  traitName: string;
  component: string;
}

export interface VizTraitResolution {
  chartType: ChartType | null;
  markTraits: string[];
  encodings: EncodingConfig[];
  layout: LayoutConfig;
  scales: ScaleConfig[];
  interactions: InteractionConfig[];
  allResolved: string[];
  unrecognized: string[];
}

/* ------------------------------------------------------------------ */
/*  Normalization                                                      */
/* ------------------------------------------------------------------ */

/**
 * Normalize trait names from various formats to kebab-case:
 *   - "MarkBar" → "mark-bar"
 *   - "viz/MarkBar" → "mark-bar"
 *   - "mark-bar" → "mark-bar" (no-op)
 *   - "EncodingPositionX" → "encoding-position-x"
 */
function normalizeTraitName(raw: string): string {
  // Strip path prefix (e.g., "viz/MarkBar" → "MarkBar")
  const name = raw.includes('/') ? raw.split('/').pop()! : raw;

  // If already kebab-case, return as-is
  if (name.includes('-') && name === name.toLowerCase()) {
    return name;
  }

  // Convert PascalCase to kebab-case
  return name
    .replace(/([A-Z])/g, (_m, p1, offset) => (offset > 0 ? '-' : '') + p1.toLowerCase())
    .replace(/--+/g, '-');
}

/* ------------------------------------------------------------------ */
/*  Trait classification maps                                          */
/* ------------------------------------------------------------------ */

const MARK_TRAITS: Record<string, ChartType> = {
  'mark-bar': 'bar',
  'mark-line': 'line',
  'mark-area': 'area',
  'mark-point': 'point',
};

const ENCODING_TRAITS: Record<string, Omit<EncodingConfig, 'traitName'>> = {
  'encoding-position-x': { channel: 'x', defaultScale: 'linear', axisTitle: 'X Axis' },
  'encoding-position-y': { channel: 'y', defaultScale: 'linear', axisTitle: 'Y Axis' },
  'encoding-color': { channel: 'color', defaultScale: 'linear' },
  'encoding-size': { channel: 'size', defaultScale: 'linear' },
};

const LAYOUT_TRAITS: Record<string, LayoutStrategy> = {
  'layout-layer': 'layer',
  'layout-facet': 'facet',
  'layout-concat': 'concat',
};

const SCALE_TRAITS: Record<string, ScaleType> = {
  'scale-linear': 'linear',
  'scale-temporal': 'temporal',
};

const INTERACTION_TRAITS: Record<string, { type: 'tooltip' | 'highlight'; component: string }> = {
  'interaction-tooltip': { type: 'tooltip', component: 'VizTooltip' },
  'interaction-highlight': { type: 'highlight', component: 'VizHighlight' },
};

const ALL_VIZ_TRAIT_NAMES = new Set([
  ...Object.keys(MARK_TRAITS),
  ...Object.keys(ENCODING_TRAITS),
  ...Object.keys(LAYOUT_TRAITS),
  ...Object.keys(SCALE_TRAITS),
  ...Object.keys(INTERACTION_TRAITS),
]);

/* ------------------------------------------------------------------ */
/*  Resolution engine                                                  */
/* ------------------------------------------------------------------ */

export function resolveVizTraits(rawTraits: string[]): VizTraitResolution {
  const normalized = rawTraits.map((t) => ({ raw: t, norm: normalizeTraitName(t) }));

  let chartType: ChartType | null = null;
  const markTraits: string[] = [];
  const encodings: EncodingConfig[] = [];
  let layout: LayoutConfig = { strategy: 'single' };
  const scales: ScaleConfig[] = [];
  const interactions: InteractionConfig[] = [];
  const allResolved: string[] = [];
  const unrecognized: string[] = [];

  for (const { raw, norm } of normalized) {
    // Mark traits
    if (MARK_TRAITS[norm]) {
      chartType = MARK_TRAITS[norm];
      markTraits.push(norm);
      allResolved.push(raw);
      continue;
    }

    // Encoding traits
    if (ENCODING_TRAITS[norm]) {
      const config = ENCODING_TRAITS[norm];
      encodings.push({ ...config, traitName: norm });
      allResolved.push(raw);
      continue;
    }

    // Layout traits
    if (LAYOUT_TRAITS[norm]) {
      layout = { strategy: LAYOUT_TRAITS[norm], traitName: norm };
      allResolved.push(raw);
      continue;
    }

    // Scale traits
    if (SCALE_TRAITS[norm]) {
      scales.push({ type: SCALE_TRAITS[norm], traitName: norm });
      allResolved.push(raw);
      continue;
    }

    // Interaction traits
    if (INTERACTION_TRAITS[norm]) {
      const config = INTERACTION_TRAITS[norm];
      interactions.push({ ...config, traitName: norm });
      allResolved.push(raw);
      continue;
    }

    // Not a viz trait — may be a non-viz trait from the object
    if (!ALL_VIZ_TRAIT_NAMES.has(norm)) {
      unrecognized.push(raw);
    }
  }

  return {
    chartType,
    markTraits,
    encodings,
    layout,
    scales,
    interactions,
    allResolved,
    unrecognized,
  };
}

/**
 * Apply scale trait resolution to encoding config.
 * If a temporal scale is present, update x-axis default to temporal.
 */
export function applyScalesToEncodings(resolution: VizTraitResolution): VizTraitResolution {
  const hasTemporal = resolution.scales.some((s) => s.type === 'temporal');
  if (!hasTemporal) return resolution;

  const updatedEncodings = resolution.encodings.map((enc) => {
    // Temporal scale upgrades x-axis default
    if (enc.channel === 'x') {
      return { ...enc, defaultScale: 'temporal' as ScaleType };
    }
    return enc;
  });

  return { ...resolution, encodings: updatedEncodings };
}

/**
 * ORCA v2.1.0 prop compatibility layer.
 *
 * Maps ORCA inferred prop definitions to OODS propMappings coercion types.
 * Supports both v2.0.0 (type, values[], required) and v2.1.0 (adds source, confidence).
 */
import type { CoercionDef, PropMapping } from './map.shared.js';

/**
 * ORCA v2.0.0 prop definition.
 */
export interface OrcaPropDef {
  type: string;
  required?: boolean;
  values?: string[];
}

/**
 * ORCA v2.1.0 inferred prop definition (extends v2.0.0).
 */
export interface OrcaInferredPropDef extends OrcaPropDef {
  source?: 'static_analysis' | 'runtime_trace' | 'storybook' | 'inferred';
  confidence?: number;
}

/**
 * Derive OODS coercion type from an ORCA prop definition.
 *
 * Mapping rules:
 * - string with values[] → enum (identity mapping: value→value)
 * - boolean → boolean_to_string (true→"true", false→"false")
 * - number, string (no values), array, date → identity
 *
 * Returns null when identity (no transform needed).
 */
export function deriveCoercion(prop: OrcaPropDef | OrcaInferredPropDef): CoercionDef | null {
  // String with enumerated values → enum coercion (self-mapping as default)
  if (prop.type === 'string' && prop.values && prop.values.length > 0) {
    const mapping: Record<string, string> = {};
    for (const v of prop.values) {
      mapping[v] = v; // Identity enum mapping; consumers can customize later
    }
    return { type: 'enum', mapping };
  }

  // Boolean → boolean_to_string coercion
  if (prop.type === 'boolean') {
    return { type: 'boolean_to_string', trueValue: 'true', falseValue: 'false' };
  }

  // All other types pass through as identity
  return null;
}

/**
 * Convert a map of ORCA prop definitions to OODS propMappings array.
 *
 * Each ORCA prop becomes a PropMapping with:
 * - externalProp = ORCA prop name
 * - oodsProp = same name (default 1:1; consumer can rename)
 * - coercion = derived from type/values
 */
export function orcaPropsToMappings(
  props: Record<string, OrcaPropDef | OrcaInferredPropDef>,
): PropMapping[] {
  return Object.entries(props).map(([name, def]) => {
    const coercion = deriveCoercion(def);
    return {
      externalProp: name,
      oodsProp: name,
      ...(coercion ? { coercion } : {}),
    };
  });
}

/**
 * Check whether all ORCA prop types in a definition set are compatible
 * with OODS coercion types. Returns incompatible type names if any.
 *
 * Currently all types are compatible: string, number, boolean, array, date, object.
 */
export function auditCompatibility(
  props: Record<string, OrcaPropDef | OrcaInferredPropDef>,
): { compatible: boolean; unsupportedTypes: string[] } {
  const knownTypes = new Set(['string', 'number', 'boolean', 'array', 'date', 'object']);
  const unsupported: string[] = [];

  for (const [name, def] of Object.entries(props)) {
    if (!knownTypes.has(def.type)) {
      unsupported.push(`${name}: ${def.type}`);
    }
  }

  return {
    compatible: unsupported.length === 0,
    unsupportedTypes: unsupported,
  };
}

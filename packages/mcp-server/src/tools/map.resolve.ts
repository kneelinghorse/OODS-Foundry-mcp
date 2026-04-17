/**
 * map.resolve MCP tool handler.
 * Resolves an external component reference to its OODS trait mapping
 * with detailed prop translations and coercion support.
 */
import { loadMappings } from './map.shared.js';
import type { CoercionDef } from './map.shared.js';
import { coerce, normalizeCoercion } from './coercion.js';
import type { MapResolveInput, MapResolveOutput, MapPropTranslation } from './types.js';

export async function handle(input: MapResolveInput): Promise<MapResolveOutput> {
  const doc = loadMappings();

  const mapping = doc.mappings.find(
    (m) =>
      m.externalSystem.toLowerCase() === input.externalSystem.toLowerCase() &&
      m.externalComponent.toLowerCase() === input.externalComponent.toLowerCase(),
  );

  if (!mapping) {
    return {
      status: 'not_found',
      message:
        `No mapping found for ${input.externalSystem}/${input.externalComponent}. ` +
        'Use map.list to see available systems, or map.create with apply=true to add one.',
    };
  }

  // Build flattened prop translations with coercion details. Stage1 v1.6.0 may
  // emit coercion as a raw string label (enum-map | type-cast | identity) rather
  // than a structured CoercionDef; surface the original label as coercionType
  // and leave coercionDetail null since there's no resolvable structure.
  const propTranslations: MapPropTranslation[] = (mapping.propMappings ?? []).map((pm) => {
    if (typeof pm.coercion === 'string') {
      return {
        externalProp: pm.externalProp,
        oodsProp: pm.oodsProp,
        coercionType: pm.coercion,
        coercionDetail: null,
      };
    }
    const coercionDef = normalizeCoercion(pm.coercion);
    return {
      externalProp: pm.externalProp,
      oodsProp: pm.oodsProp,
      coercionType: coercionDef.type,
      coercionDetail: buildCoercionDetail(coercionDef),
    };
  });

  return {
    status: 'ok',
    mapping,
    propTranslations,
  };
}

/**
 * Resolve a single prop value through its coercion.
 * Used when map_resolve is called with source values to transform.
 * Stage1 v1.6.0 raw-string coercions (enum-map / type-cast / identity) are
 * treated as pass-through identity at the value level — the structured detail
 * needed to actually transform values is not present in the string label.
 */
export function resolveValue(
  value: unknown,
  coercion: CoercionDef | string | null | undefined,
): unknown {
  if (typeof coercion === 'string') return value;
  return coerce(value, normalizeCoercion(coercion));
}

function buildCoercionDetail(coercion: CoercionDef): Record<string, unknown> {
  switch (coercion.type) {
    case 'identity':
      return { type: 'identity' };
    case 'enum':
      return { type: 'enum', mapping: coercion.mapping };
    case 'boolean_to_string':
      return { type: 'boolean_to_string', trueValue: coercion.trueValue, falseValue: coercion.falseValue };
    case 'template':
      return { type: 'template', pattern: coercion.pattern };
  }
}

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

  // Build flattened prop translations with coercion details
  const propTranslations: MapPropTranslation[] = (mapping.propMappings ?? []).map((pm) => {
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
 */
export function resolveValue(value: unknown, coercion: CoercionDef | null | undefined): unknown {
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

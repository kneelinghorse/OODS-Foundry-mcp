/**
 * map.resolve MCP tool handler.
 * Resolves an external component reference to its OODS trait mapping
 * with detailed prop translations.
 */
import { loadMappings } from './map.shared.js';
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
      message: `No mapping found for ${input.externalSystem}/${input.externalComponent}.`,
    };
  }

  // Build flattened prop translations with coercion details
  const propTranslations: MapPropTranslation[] = (mapping.propMappings ?? []).map((pm) => ({
    externalProp: pm.externalProp,
    oodsProp: pm.oodsProp,
    coercionType: pm.coercion?.type ?? null,
    coercionDetail: pm.coercion ? buildCoercionDetail(pm.coercion) : null,
  }));

  return {
    status: 'ok',
    mapping,
    propTranslations,
  };
}

function buildCoercionDetail(coercion: NonNullable<import('./map.shared.js').CoercionHint>): Record<string, unknown> {
  const detail: Record<string, unknown> = { type: coercion.type };
  if (coercion.type === 'enum-map' && coercion.values) {
    detail.values = coercion.values;
  }
  if (coercion.type === 'string-template' && coercion.template) {
    detail.template = coercion.template;
  }
  if (coercion.type === 'type-cast' && coercion.targetType) {
    detail.targetType = coercion.targetType;
  }
  return detail;
}

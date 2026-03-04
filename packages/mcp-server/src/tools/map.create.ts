/**
 * map.create MCP tool handler.
 * Creates a component-to-trait mapping for an external design system component.
 */
import {
  loadMappings,
  saveMappings,
  computeMappingsEtag,
  generateMappingId,
  loadKnownTraits,
  type ComponentMapping,
  type PropMapping,
  type MappingMetadata,
} from './map.shared.js';
import type { MapCreateInput, MapCreateOutput } from './types.js';
import { formatValidationErrors } from '../security/errors.js';

export async function handle(input: MapCreateInput): Promise<MapCreateOutput> {
  const doc = loadMappings();
  const warnings: string[] = [];
  const applied = input.apply === true;

  // Generate ID
  const id = generateMappingId(input.externalSystem, input.externalComponent);

  // Duplicate detection
  const existing = doc.mappings.find(
    (m) =>
      m.externalSystem.toLowerCase() === input.externalSystem.toLowerCase() &&
      m.externalComponent.toLowerCase() === input.externalComponent.toLowerCase(),
  );
  if (existing) {
    const formatted = formatValidationErrors(
      [
        {
          keyword: 'duplicate',
          instancePath: '/externalSystem',
          params: {},
          message: `mapping for '${input.externalSystem}/${input.externalComponent}' already exists (id: '${existing.id}').`,
        },
        {
          keyword: 'duplicate',
          instancePath: '/externalComponent',
          params: {},
          message: `mapping for '${input.externalSystem}/${input.externalComponent}' already exists (id: '${existing.id}').`,
        },
      ],
      { prefix: 'Mapping validation failed' },
    );

    return {
      status: 'error',
      mapping: existing,
      etag: computeMappingsEtag(doc),
      applied: false,
      errors: formatted,
    };
  }

  // Validate referenced traits exist
  const knownTraits = loadKnownTraits();
  if (knownTraits.size > 0) {
    for (const trait of input.oodsTraits) {
      if (!knownTraits.has(trait)) {
        warnings.push(`Unknown trait '${trait}' — not found in current OODS trait registry.`);
      }
    }
  }

  // Build mapping record
  const now = new Date().toISOString();
  const propMappings: PropMapping[] | undefined = input.propMappings?.map((pm) => ({
    externalProp: pm.externalProp,
    oodsProp: pm.oodsProp,
    coercion: pm.coercion ?? null,
  }));

  const metadata: MappingMetadata = {
    createdAt: now,
    ...(input.metadata?.author ? { author: input.metadata.author } : {}),
    ...(input.metadata?.notes ? { notes: input.metadata.notes } : {}),
  };

  const mapping: ComponentMapping = {
    id,
    externalSystem: input.externalSystem,
    externalComponent: input.externalComponent,
    oodsTraits: input.oodsTraits,
    ...(propMappings && propMappings.length > 0 ? { propMappings } : {}),
    confidence: input.confidence ?? 'manual',
    metadata,
  };

  if (!applied) {
    warnings.push(
      'Dry run: mapping not persisted. Set apply=true to write to artifacts/structured-data/component-mappings.json.',
    );
  } else {
    doc.mappings.push(mapping);
    saveMappings(doc);
  }

  const etag = computeMappingsEtag(doc);

  return {
    status: 'ok',
    mapping,
    etag,
    applied,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

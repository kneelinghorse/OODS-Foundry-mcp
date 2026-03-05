/**
 * map.update MCP tool handler.
 * Partially updates an existing component-to-trait mapping.
 */
import {
  loadMappings,
  saveMappings,
  computeMappingsEtag,
} from './map.shared.js';
import type { MapUpdateInput, MapUpdateOutput } from './types.js';

export async function handle(input: MapUpdateInput): Promise<MapUpdateOutput> {
  const doc = loadMappings();

  const index = doc.mappings.findIndex((m) => m.id === input.id);
  if (index === -1) {
    return {
      status: 'error',
      message: `No mapping found with id '${input.id}'. Use map.list to see available mappings.`,
    };
  }

  const mapping = { ...doc.mappings[index] };
  const changes: string[] = [];

  // Apply partial updates
  if (input.updates.oodsTraits !== undefined) {
    mapping.oodsTraits = input.updates.oodsTraits;
    changes.push('oodsTraits');
  }

  if (input.updates.confidence !== undefined) {
    mapping.confidence = input.updates.confidence;
    changes.push('confidence');
  }

  if (input.updates.propMappings !== undefined) {
    mapping.propMappings = input.updates.propMappings;
    changes.push('propMappings');
  }

  if (input.updates.notes !== undefined) {
    mapping.metadata = {
      ...mapping.metadata,
      updatedAt: new Date().toISOString(),
      notes: input.updates.notes,
    };
    changes.push('notes');
  } else {
    mapping.metadata = {
      ...mapping.metadata,
      updatedAt: new Date().toISOString(),
    };
  }

  if (changes.length === 0) {
    return {
      status: 'ok',
      mapping,
      etag: computeMappingsEtag(doc),
      changes: [],
      message: 'No changes applied.',
    };
  }

  doc.mappings[index] = mapping;
  saveMappings(doc);

  return {
    status: 'ok',
    mapping,
    etag: computeMappingsEtag(doc),
    changes,
  };
}

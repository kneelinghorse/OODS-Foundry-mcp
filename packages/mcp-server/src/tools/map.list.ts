/**
 * map.list MCP tool handler.
 * Lists component-to-trait mappings, optionally filtered by external system.
 */
import { loadMappings, computeMappingsEtag } from './map.shared.js';
import type { MapListInput, MapListOutput } from './types.js';

export async function handle(input: MapListInput): Promise<MapListOutput> {
  const doc = loadMappings();

  let mappings = doc.mappings;
  if (input.externalSystem) {
    const filter = input.externalSystem.toLowerCase();
    mappings = mappings.filter((m) => m.externalSystem.toLowerCase() === filter);
  }

  const etag = computeMappingsEtag(doc);

  return {
    mappings,
    totalCount: mappings.length,
    stats: {
      mappingCount: doc.stats.mappingCount,
      systemCount: doc.stats.systemCount,
    },
    etag,
  };
}

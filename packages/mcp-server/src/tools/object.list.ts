/**
 * object.list — MCP tool returning all domain objects with metadata and optional filters.
 */

import { listObjects, loadObject } from '../objects/object-loader.js';
import type { ObjectDefinition } from '../objects/types.js';

export type ObjectListInput = {
  domain?: string;
  maturity?: string;
  trait?: string;
};

export type ObjectListEntry = {
  name: string;
  domain: string;
  version: string;
  maturity: string | null;
  description: string;
  traits: string[];
  fieldCount: number;
  tags: string[];
};

export type ObjectListOutput = {
  objects: ObjectListEntry[];
  totalCount: number;
  filters: {
    domain: string | null;
    maturity: string | null;
    trait: string | null;
  };
};

function toEntry(def: ObjectDefinition): ObjectListEntry {
  const traitNames = (def.traits ?? []).map((t) => t.name);
  const fieldCount = Object.keys(def.schema ?? {}).length;
  return {
    name: def.object.name,
    domain: def.object.domain,
    version: def.object.version,
    maturity: def.metadata?.maturity ?? null,
    description: def.object.description,
    traits: traitNames,
    fieldCount,
    tags: def.object.tags ?? [],
  };
}

export async function handle(input: ObjectListInput): Promise<ObjectListOutput> {
  const names = listObjects();
  let entries: ObjectListEntry[] = [];

  for (const name of names) {
    const def = loadObject(name);
    entries.push(toEntry(def));
  }

  // Apply filters
  if (input.domain) {
    const domainFilter = input.domain.toLowerCase();
    entries = entries.filter(
      (e) => e.domain.toLowerCase() === domainFilter || e.domain.toLowerCase().startsWith(domainFilter + '.'),
    );
  }

  if (input.maturity) {
    const maturityFilter = input.maturity.toLowerCase();
    entries = entries.filter(
      (e) => e.maturity !== null && e.maturity.toLowerCase() === maturityFilter,
    );
  }

  if (input.trait) {
    const traitFilter = input.trait.toLowerCase();
    entries = entries.filter((e) =>
      e.traits.some(
        (t) =>
          t.toLowerCase() === traitFilter ||
          t.toLowerCase().endsWith('/' + traitFilter),
      ),
    );
  }

  return {
    objects: entries,
    totalCount: entries.length,
    filters: {
      domain: input.domain ?? null,
      maturity: input.maturity ?? null,
      trait: input.trait ?? null,
    },
  };
}

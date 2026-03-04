/**
 * Trait composition engine.
 * Given an object definition, merges trait schemas, view_extensions, semantics, and tokens
 * into a unified ComposedObject.
 */

import { loadTrait } from './trait-loader.js';
import type {
  FieldDefinition,
  ObjectDefinition,
  SemanticMapping,
  TraitDefinition,
  TraitReference,
  ViewExtension,
} from './types.js';

// ---- Composition output types ----

export interface ResolvedTrait {
  ref: TraitReference;
  definition: TraitDefinition;
}

export interface ComposedObject {
  /** Original object header */
  object: ObjectDefinition['object'];
  /** Resolved trait references with their full definitions */
  traits: ResolvedTrait[];
  /** Merged field schema: object fields override trait fields */
  schema: Record<string, FieldDefinition>;
  /** Merged semantic mappings: object overrides traits */
  semantics: Record<string, SemanticMapping>;
  /** Collected and priority-sorted view_extensions per context */
  viewExtensions: Record<string, ViewExtension[]>;
  /** Combined token map: object tokens override trait tokens */
  tokens: Record<string, unknown>;
  /** Collision/warning messages produced during composition */
  warnings: string[];
}

/** Internal type for tracking priority resolution order */
interface RankedExtension {
  extension: ViewExtension;
  traitOrder: number;
}

/**
 * Compose an object definition by resolving all its traits.
 * Merges schemas (field collision = last-trait-wins + warning),
 * collects view_extensions (priority-sorted per context),
 * and combines token maps (object overrides traits).
 */
export function composeObject(objectDef: ObjectDefinition): ComposedObject {
  const warnings: string[] = [];
  const schema: Record<string, FieldDefinition> = {};
  const semantics: Record<string, SemanticMapping> = {};
  const extensionsByContext: Record<string, RankedExtension[]> = {};
  const tokens: Record<string, unknown> = {};
  const resolvedTraits: ResolvedTrait[] = [];

  // 1. Process each trait in declaration order
  const traits = objectDef.traits ?? [];
  for (let traitOrder = 0; traitOrder < traits.length; traitOrder++) {
    const ref = traits[traitOrder];
    let traitDef: TraitDefinition;
    try {
      traitDef = loadTrait(ref.name);
    } catch (err) {
      warnings.push(
        `Failed to load trait "${ref.name}": ${(err as Error).message}`,
      );
      continue;
    }

    resolvedTraits.push({ ref, definition: traitDef });

    // Merge trait schema fields (collision = last-trait-wins with warning)
    for (const [field, fieldDef] of Object.entries(traitDef.schema)) {
      if (field in schema) {
        warnings.push(
          `Field collision: "${field}" from trait "${traitDef.trait.name}" overrides prior trait definition`,
        );
      }
      schema[field] = fieldDef;
    }

    // Merge trait semantic mappings
    for (const [field, mapping] of Object.entries(traitDef.semantics)) {
      semantics[field] = mapping;
    }

    // Collect view_extensions with trait order for priority resolution
    for (const [context, extensions] of Object.entries(
      traitDef.view_extensions ?? {},
    )) {
      if (!extensionsByContext[context]) {
        extensionsByContext[context] = [];
      }
      for (const ext of extensions) {
        extensionsByContext[context].push({
          extension: ext,
          traitOrder,
        });
      }
    }

    // Merge trait tokens (later traits override earlier)
    for (const [key, value] of Object.entries(traitDef.tokens ?? {})) {
      tokens[key] = value;
    }
  }

  // 2. Overlay object's own schema fields (override trait fields)
  for (const [field, fieldDef] of Object.entries(objectDef.schema ?? {})) {
    if (field in schema) {
      warnings.push(
        `Field collision: "${field}" in object schema overrides trait definition`,
      );
    }
    schema[field] = fieldDef;
  }

  // 3. Overlay object semantic mappings
  for (const [field, mapping] of Object.entries(objectDef.semantics ?? {})) {
    semantics[field] = mapping;
  }

  // 4. Overlay object tokens (final override)
  for (const [key, value] of Object.entries(objectDef.tokens ?? {})) {
    tokens[key] = value;
  }

  // 5. Resolve view_extension priorities per context
  //    Higher priority first; same priority → earlier trait declaration order first
  const viewExtensions: Record<string, ViewExtension[]> = {};
  for (const [context, ranked] of Object.entries(extensionsByContext)) {
    ranked.sort((a, b) => {
      const pA = a.extension.priority ?? 0;
      const pB = b.extension.priority ?? 0;
      if (pB !== pA) return pB - pA; // higher priority first
      return a.traitOrder - b.traitOrder; // earlier trait first on tie
    });
    viewExtensions[context] = ranked.map((r) => r.extension);
  }

  return {
    object: objectDef.object,
    traits: resolvedTraits,
    schema,
    semantics,
    viewExtensions,
    tokens,
    warnings,
  };
}

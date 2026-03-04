/**
 * Trait loader with singleton cache.
 * Scans traits/{core,lifecycle,financial,content,behavioral,visual,structural,viz}/
 * and domains/* /traits/ for *.trait.yaml files.
 * Supports lookup by simple name ("Priceable") or category-qualified ("financial/Priceable").
 */

import { load as parseYaml } from 'js-yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TraitDefinition } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');

const TRAIT_SCAN_ROOTS = [
  path.join(REPO_ROOT, 'traits'),
  path.join(REPO_ROOT, 'domains'),
];

/** simple name -> file path (e.g. "Priceable" -> path) */
let nameIndex: Map<string, string> | null = null;
/** category/name -> file path (e.g. "financial/Priceable" -> path) */
let qualifiedIndex: Map<string, string> | null = null;
/** lookup key -> parsed TraitDefinition */
let traitCache: Map<string, TraitDefinition> = new Map();

function scanDirectory(dir: string, nameIdx: Map<string, string>, qualIdx: Map<string, string>): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, nameIdx, qualIdx);
    } else if (entry.name.endsWith('.trait.yaml')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = parseYaml(content) as Record<string, unknown>;
        const header = parsed?.trait as Record<string, unknown> | undefined;
        const name = header?.name as string | undefined;
        const category = header?.category as string | undefined;
        if (name) {
          nameIdx.set(name, fullPath);
          if (category) {
            qualIdx.set(`${category}/${name}`, fullPath);
          }
        }
      } catch {
        // Skip malformed YAML during index build
      }
    }
  }
}

function ensureIndex(): { names: Map<string, string>; qualified: Map<string, string> } {
  if (nameIndex && qualifiedIndex) {
    return { names: nameIndex, qualified: qualifiedIndex };
  }

  nameIndex = new Map();
  qualifiedIndex = new Map();
  for (const root of TRAIT_SCAN_ROOTS) {
    scanDirectory(root, nameIndex, qualifiedIndex);
  }
  return { names: nameIndex, qualified: qualifiedIndex };
}

function normalize(raw: Record<string, unknown>): TraitDefinition {
  return {
    trait: raw.trait as TraitDefinition['trait'],
    parameters: (raw.parameters as TraitDefinition['parameters']) ?? [],
    schema: (raw.schema as TraitDefinition['schema']) ?? {},
    semantics: (raw.semantics as TraitDefinition['semantics']) ?? {},
    view_extensions: (raw.view_extensions as TraitDefinition['view_extensions']) ?? {},
    tokens: (raw.tokens as TraitDefinition['tokens']) ?? {},
    events: raw.events as TraitDefinition['events'] | undefined,
    dependencies: (raw.dependencies as TraitDefinition['dependencies']) ?? [],
    metadata: (raw.metadata as TraitDefinition['metadata']) ?? {},
  };
}

/**
 * Resolve a trait name to its file path.
 * Accepts "Priceable", "financial/Priceable", or any category-qualified form.
 */
function resolveTraitPath(name: string): string | undefined {
  const { names, qualified } = ensureIndex();

  // Try exact match on simple name first
  const byName = names.get(name);
  if (byName) return byName;

  // Try qualified match (e.g. "financial/Priceable")
  const byQualified = qualified.get(name);
  if (byQualified) return byQualified;

  // Try resolving "lifecycle/Stateful" -> map directory prefix to category
  // The YAML category might differ from the directory name, so also try
  // matching the second segment as a simple name
  if (name.includes('/')) {
    const simpleName = name.split('/').pop()!;
    const bySimple = names.get(simpleName);
    if (bySimple) return bySimple;
  }

  return undefined;
}

/**
 * Load a single trait definition by name.
 * Accepts simple ("Priceable") or category-qualified ("financial/Priceable") forms.
 * Returns a cached result on subsequent calls.
 */
export function loadTrait(name: string): TraitDefinition {
  const cached = traitCache.get(name);
  if (cached) return cached;

  const filePath = resolveTraitPath(name);

  if (!filePath) {
    const { names } = ensureIndex();
    const available = Array.from(names.keys()).sort();
    throw new Error(
      `Trait "${name}" not found. Available: ${available.join(', ')}`,
    );
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const raw = parseYaml(content) as Record<string, unknown>;
  const def = normalize(raw);

  // Cache under both the requested key and the canonical name
  traitCache.set(name, def);
  if (def.trait.name !== name) {
    traitCache.set(def.trait.name, def);
  }

  return def;
}

/** List all discovered trait names (sorted, simple names only). */
export function listTraits(): string[] {
  return Array.from(ensureIndex().names.keys()).sort();
}

/** Load all traits into a name->definition map (keyed by canonical trait name). */
export function loadAllTraits(): Map<string, TraitDefinition> {
  const result = new Map<string, TraitDefinition>();
  for (const name of listTraits()) {
    result.set(name, loadTrait(name));
  }
  return result;
}

/** Get the file path for a named trait, or undefined if not found. */
export function getTraitFilePath(name: string): string | undefined {
  return resolveTraitPath(name);
}

/** Clear all caches. Primarily for testing. */
export function clearTraitCache(): void {
  nameIndex = null;
  qualifiedIndex = null;
  traitCache = new Map();
}

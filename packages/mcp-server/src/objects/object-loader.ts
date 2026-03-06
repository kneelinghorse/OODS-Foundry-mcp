/**
 * Object loader with singleton cache.
 * Scans objects/core/, objects/content/, and domains/* /objects/ for *.object.yaml files.
 */

import { load as parseYaml } from 'js-yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ObjectDefinition } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');

const OBJECT_SCAN_ROOTS = [
  path.join(REPO_ROOT, 'objects'),
  path.join(REPO_ROOT, 'domains'),
];

/** name -> file path */
let objectIndex: Map<string, string> | null = null;
/** name -> parsed ObjectDefinition */
let objectCache: Map<string, ObjectDefinition> = new Map();

function scanDirectory(dir: string, index: Map<string, string>): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // directory doesn't exist or unreadable
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, index);
    } else if (entry.name.endsWith('.object.yaml')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = parseYaml(content) as Record<string, unknown>;
        const header = parsed?.object as Record<string, unknown> | undefined;
        const name = header?.name as string | undefined;
        if (name && !index.has(name)) {
          index.set(name, fullPath);
        }
      } catch {
        // Skip malformed YAML during index build
      }
    }
  }
}

function ensureIndex(): Map<string, string> {
  if (objectIndex) return objectIndex;

  objectIndex = new Map();
  for (const root of OBJECT_SCAN_ROOTS) {
    scanDirectory(root, objectIndex);
  }
  return objectIndex;
}

function normalize(raw: Record<string, unknown>): ObjectDefinition {
  return {
    object: raw.object as ObjectDefinition['object'],
    traits: (raw.traits as ObjectDefinition['traits']) ?? [],
    schema: (raw.schema as ObjectDefinition['schema']) ?? {},
    semantics: (raw.semantics as ObjectDefinition['semantics']) ?? {},
    tokens: (raw.tokens as ObjectDefinition['tokens']) ?? {},
    metadata: (raw.metadata as ObjectDefinition['metadata']) ?? {},
  };
}

/**
 * Load a single object definition by name.
 * Returns a cached result on subsequent calls.
 */
export function loadObject(name: string): ObjectDefinition {
  const cached = objectCache.get(name);
  if (cached) return cached;

  const index = ensureIndex();
  const filePath = index.get(name);

  if (!filePath) {
    const available = Array.from(index.keys()).sort();
    throw new Error(
      `Object "${name}" not found. Available: ${available.join(', ')}`,
    );
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const raw = parseYaml(content) as Record<string, unknown>;
  const def = normalize(raw);

  objectCache.set(name, def);
  return def;
}

/** List all discovered object names (sorted). */
export function listObjects(): string[] {
  return Array.from(ensureIndex().keys()).sort();
}

/** Load all objects into a name->definition map. */
export function loadAllObjects(): Map<string, ObjectDefinition> {
  const result = new Map<string, ObjectDefinition>();
  for (const name of listObjects()) {
    result.set(name, loadObject(name));
  }
  return result;
}

/** Get the file path for a named object, or undefined if not found. */
export function getObjectFilePath(name: string): string | undefined {
  return ensureIndex().get(name);
}

/** Clear all caches. Primarily for testing. */
export function clearObjectCache(): void {
  objectIndex = null;
  objectCache = new Map();
}

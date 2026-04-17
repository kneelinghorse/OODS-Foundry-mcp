/**
 * Shared utilities for map.create, map.list, and map.resolve tools.
 * Handles mapping file I/O, trait validation, and ID generation.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Stage1ProjectionVariant } from "./types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../../");
const ARTIFACT_DIR = path.join(REPO_ROOT, "artifacts", "structured-data");
const MAPPINGS_PATH = path.join(ARTIFACT_DIR, "component-mappings.json");
const MANIFEST_PATH = path.join(ARTIFACT_DIR, "manifest.json");
const PLANNING_DIR = path.join(REPO_ROOT, "cmos", "planning");

export type CoercionEnum = {
  type: "enum";
  mapping: Record<string, string>;
};

export type CoercionBooleanToString = {
  type: "boolean_to_string";
  trueValue: string;
  falseValue: string;
};

export type CoercionTemplate = {
  type: "template";
  pattern: string;
};

export type CoercionIdentity = {
  type: "identity";
};

export type CoercionDef =
  | CoercionEnum
  | CoercionBooleanToString
  | CoercionTemplate
  | CoercionIdentity;

/** @deprecated Use CoercionDef instead */
export type CoercionHint = CoercionDef;

/**
 * Stage1 v1.6.0 emits propMappings[].coercion as a raw string label
 * ("enum-map", "type-cast", "identity") rather than a structured CoercionDef.
 * Persisted as-is for round-trip fidelity; the resolver treats unknown
 * string labels as pass-through identity for value transformation while
 * preserving the original label as coercionType.
 */
export type CoercionString = string;

export type PropMapping = {
  externalProp: string;
  oodsProp: string;
  coercion?: CoercionDef | CoercionString | null;
};

export type MappingMetadata = {
  createdAt?: string;
  updatedAt?: string;
  author?: string;
  notes?: string;
};

export type ComponentMapping = {
  id: string;
  externalSystem: string;
  externalComponent: string;
  oodsTraits: string[];
  propMappings?: PropMapping[];
  confidence: "auto" | "manual";
  metadata?: MappingMetadata;
  projection_variants?: Stage1ProjectionVariant[];
};

export type MappingsDoc = {
  $schema?: string;
  generatedAt: string;
  version: string;
  stats: { mappingCount: number; systemCount: number };
  mappings: ComponentMapping[];
};

export function loadMappings(): MappingsDoc {
  if (!fs.existsSync(MAPPINGS_PATH)) {
    const now = new Date().toISOString();
    return {
      $schema:
        "../../packages/mcp-server/src/schemas/component-mapping.schema.json",
      generatedAt: now,
      version: now.slice(0, 10),
      stats: { mappingCount: 0, systemCount: 0 },
      mappings: [],
    };
  }
  return JSON.parse(fs.readFileSync(MAPPINGS_PATH, "utf8")) as MappingsDoc;
}

export function saveMappings(doc: MappingsDoc): void {
  const now = new Date().toISOString();
  doc.generatedAt = now;
  doc.version = now.slice(0, 10);
  doc.stats.mappingCount = doc.mappings.length;
  doc.stats.systemCount = new Set(
    doc.mappings.map((m) => m.externalSystem),
  ).size;
  fs.writeFileSync(MAPPINGS_PATH, JSON.stringify(doc, null, 2) + "\n", "utf8");
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const ordered: Record<string, unknown> = Object.create(null);
    for (const [key, val] of entries) {
      ordered[key] = stableSort(val);
    }
    return ordered;
  }
  return value;
}

export function computeMappingsEtag(doc: MappingsDoc): string {
  const base = Object.assign(
    Object.create(null),
    doc as Record<string, unknown>,
  );
  delete base.generatedAt;
  const canonical = JSON.stringify(stableSort(base));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function slugify(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function generateMappingId(
  externalSystem: string,
  externalComponent: string,
): string {
  return `${slugify(externalSystem)}-${slugify(externalComponent)}`;
}

export function loadKnownTraits(): Set<string> {
  const traits = new Set<string>();

  // Try artifact first, then planning fallback
  const manifestPath = MANIFEST_PATH;
  let componentsPath: string | undefined;

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const artifact = manifest.artifacts?.find(
      (a: any) => a.name === "components",
    );
    if (artifact?.file) {
      const candidate = path.join(ARTIFACT_DIR, artifact.file);
      if (fs.existsSync(candidate)) componentsPath = candidate;
    }
  } catch {
    // ignore
  }

  if (!componentsPath) {
    const fallback = path.join(PLANNING_DIR, "oods-components.json");
    if (fs.existsSync(fallback)) componentsPath = fallback;
  }

  if (!componentsPath) return traits;

  try {
    const data = JSON.parse(fs.readFileSync(componentsPath, "utf8"));
    if (Array.isArray(data.traits)) {
      for (const trait of data.traits) {
        if (typeof trait.name === "string") traits.add(trait.name);
      }
    }
  } catch {
    // ignore
  }

  return traits;
}

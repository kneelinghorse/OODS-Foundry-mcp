import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAjv } from '../lib/ajv.js';
import { withinAllowed } from '../lib/security.js';
import type { StructuredDataFetchInput, StructuredDataFetchOutput, StructuredDataset } from './types.js';

type ManifestArtifact = {
  name?: string;
  path?: string;
  file?: string;
  etag?: string;
  sizeBytes?: number;
};

type ManifestDoc = {
  generatedAt?: string;
  version?: string;
  source?: Record<string, unknown>;
  artifacts?: ManifestArtifact[];
  delta?: Record<string, unknown>;
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const PLANNING_DIR = path.join(REPO_ROOT, 'cmos', 'planning');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const COMPONENT_SCHEMA_PATH = path.join(PLANNING_DIR, 'component-schema.json');

const tokensSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['generatedAt', 'layers', 'stats', 'traitOverlays'],
  properties: {
    generatedAt: { type: 'string' },
    layers: {
      type: 'object',
      required: ['reference', 'theme', 'system', 'component', 'view'],
      additionalProperties: true,
    },
    maps: { type: 'object', additionalProperties: true },
    stats: {
      type: 'object',
      required: ['referenceTokens', 'themeTokens', 'systemTokens', 'componentTokens', 'viewTokens', 'mapCount', 'traitOverlayCount'],
      properties: {
        referenceTokens: { type: 'integer', minimum: 0 },
        themeTokens: { type: 'integer', minimum: 0 },
        systemTokens: { type: 'integer', minimum: 0 },
        componentTokens: { type: 'integer', minimum: 0 },
        viewTokens: { type: 'integer', minimum: 0 },
        mapCount: { type: 'integer', minimum: 0 },
        traitOverlayCount: { type: 'integer', minimum: 0 },
      },
      additionalProperties: true,
    },
    traitOverlays: { type: 'array' },
  },
  additionalProperties: true,
};

const ajv = getAjv();
const validateComponents = ajv.compile(JSON.parse(fs.readFileSync(COMPONENT_SCHEMA_PATH, 'utf8')));
const validateTokens = ajv.compile(tokensSchema);

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableSort(entry));
  }
  if (value && typeof value === 'object') {
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

export function computeStructuredDataEtag(payload: unknown): string {
  const base =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? Object.assign(Object.create(null), payload as Record<string, unknown>)
      : payload ?? {};
  if (base && typeof base === 'object' && !Array.isArray(base)) {
    delete (base as Record<string, unknown>).generatedAt;
  }
  const canonical = JSON.stringify(stableSort(base));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function relativeToRepo(target: string): string {
  const rel = path.relative(REPO_ROOT, target);
  return rel.startsWith('..') ? target : rel.split(path.sep).join('/');
}

function resolvePath(target: string): string {
  if (path.isAbsolute(target)) return target;
  const trimmed = target.startsWith('OODS-Foundry-mcp/') ? target.replace(/^OODS-Foundry-mcp\//, '') : target;
  return path.resolve(REPO_ROOT, trimmed);
}

function resolveStructuredDataPath(source: string): string | null {
  const resolved = resolvePath(source);
  if (!withinAllowed(REPO_ROOT, resolved)) return null;
  if (withinAllowed(ARTIFACT_DIR, resolved) || withinAllowed(PLANNING_DIR, resolved)) {
    return resolved;
  }
  return null;
}

function formatErrors(errors: Array<{ instancePath?: string; message?: string }> | null | undefined): string[] {
  if (!errors) return [];
  return errors.map((err) => `${err.instancePath || '/'} ${err.message || ''}`.trim());
}

function loadManifest(): { manifest?: ManifestDoc; path?: string } {
  const manifestPath = path.join(ARTIFACT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return {};
  try {
    return { manifest: readJson(manifestPath) as ManifestDoc, path: manifestPath };
  } catch {
    return {};
  }
}

function findArtifact(manifest: ManifestDoc | undefined, dataset: StructuredDataset): ManifestArtifact | undefined {
  if (!manifest?.artifacts) return undefined;
  return manifest.artifacts.find((entry) => entry.name === dataset);
}

function datasetPath(dataset: StructuredDataset, manifest: ManifestDoc | undefined): { path: string; manifestArtifact?: ManifestArtifact } {
  if (dataset === 'manifest') {
    return { path: path.join(ARTIFACT_DIR, 'manifest.json') };
  }
  const manifestArtifact = findArtifact(manifest, dataset);
  const fallback = path.join(PLANNING_DIR, dataset === 'components' ? 'oods-components.json' : 'oods-tokens.json');
  const source = manifestArtifact?.path ?? manifestArtifact?.file ?? fallback;
  const resolved = resolveStructuredDataPath(source);
  return { path: resolved ?? fallback, manifestArtifact };
}

function validatePayload(dataset: StructuredDataset, payload: Record<string, unknown>): { ok: boolean; errors: string[] } {
  if (dataset === 'components') {
    const valid = Boolean(validateComponents(payload));
    return { ok: valid, errors: valid ? [] : formatErrors(validateComponents.errors as any) };
  }
  if (dataset === 'tokens') {
    const valid = Boolean(validateTokens(payload));
    return { ok: valid, errors: valid ? [] : formatErrors(validateTokens.errors as any) };
  }
  return { ok: true, errors: [] };
}

function metaFor(dataset: StructuredDataset, payload: Record<string, any>): Record<string, unknown> | undefined {
  if (dataset === 'components') {
    const stats = payload?.stats || {};
    return {
      componentCount: stats.componentCount ?? (Array.isArray(payload?.components) ? payload.components.length : undefined),
      traitCount: stats.traitCount ?? (Array.isArray(payload?.traits) ? payload.traits.length : undefined),
      objectCount: stats.objectCount ?? (Array.isArray(payload?.objects) ? payload.objects.length : undefined),
      domainCount: stats.domainCount ?? (Array.isArray(payload?.domains) ? payload.domains.length : undefined),
      patternCount: stats.patternCount ?? (Array.isArray(payload?.patterns) ? payload.patterns.length : undefined),
      traitOverlayCount: stats.traitOverlayCount ?? (Array.isArray(payload?.traitOverlays) ? payload.traitOverlays.length : undefined),
    };
  }
  if (dataset === 'tokens') {
    const stats = payload?.stats || {};
    return {
      traitOverlayCount: stats.traitOverlayCount ?? (Array.isArray(payload?.traitOverlays) ? payload.traitOverlays.length : undefined),
      tokenCounts: stats,
    };
  }
  const artifacts = payload?.artifacts;
  return artifacts ? { artifactCount: Array.isArray(artifacts) ? artifacts.length : undefined } : undefined;
}

export async function handle(input: StructuredDataFetchInput): Promise<StructuredDataFetchOutput> {
  const dataset = input.dataset;
  const includePayload = input.includePayload !== false;
  const manifestInfo = loadManifest();
  const { path: dataPath, manifestArtifact } = datasetPath(dataset, manifestInfo.manifest);

  if (!fs.existsSync(dataPath)) {
    throw new Error(`Dataset not found for "${dataset}".`);
  }

  const payload = dataset === 'manifest' && manifestInfo.manifest ? manifestInfo.manifest : readJson(dataPath);
  const etag = manifestArtifact?.etag ?? computeStructuredDataEtag(payload);
  const matched = Boolean(input.ifNoneMatch && input.ifNoneMatch === etag);
  const payloadIncluded = includePayload && !matched;
  const validation = validatePayload(dataset, payload);
  const generatedAt = (payload as Record<string, any>).generatedAt ?? manifestInfo.manifest?.generatedAt ?? null;
  const warnings: string[] = [];

  if (manifestArtifact?.etag && manifestArtifact.etag !== etag) {
    warnings.push(`Manifest ETag mismatch for ${dataset}: expected ${manifestArtifact.etag}, computed ${etag}`);
  }

  const sizeBytes = fs.statSync(dataPath).size;
  const output: StructuredDataFetchOutput = {
    dataset,
    version: manifestInfo.manifest?.version ?? null,
    generatedAt,
    etag,
    matched,
    payloadIncluded,
    path: relativeToRepo(dataPath),
    manifestPath: manifestInfo.path ? relativeToRepo(manifestInfo.path) : null,
    sizeBytes,
    schemaValidated: validation.ok,
    validationErrors: validation.errors.length ? validation.errors : undefined,
    warnings: warnings.length ? warnings : undefined,
    meta: metaFor(dataset, payload as Record<string, any>),
    payload: payloadIncluded ? (payload as Record<string, unknown>) : undefined,
  };

  return output;
}

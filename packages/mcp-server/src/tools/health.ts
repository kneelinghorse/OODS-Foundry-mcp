import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SchemaStore } from '../schema-store/index.js';
import { ToolError } from '../errors/tool-error.js';
import { CURRENT_VERSION, getChangelogSince, type ChangelogEntry } from '../versioning/versions.js';
import { listObjects } from '../objects/object-loader.js';

type ManifestArtifact = {
  name?: string;
  file?: string;
  path?: string;
};

type ManifestDoc = {
  generatedAt?: string;
  artifacts?: ManifestArtifact[];
};

type HealthInput = {
  includeChangelog?: boolean;
  sinceVersion?: string;
};

type HealthOutput = {
  status: 'ok' | 'degraded';
  server: { version: string; uptime: number };
  registry: { components: number; traits: number; objects: number; lastSync: string };
  tokens: { built: boolean; theme: string; brand: string };
  schemas: { savedCount: number; storeDir: string };
  latency: number;
  dslVersion?: string;
  warnings?: string[];
  changelog?: ChangelogEntry[];
};

const CURRENT_DIR = fileURLToPath(new URL('.', import.meta.url));
const PACKAGE_ROOT = path.resolve(CURRENT_DIR, '../../');
const REPO_ROOT = path.resolve(CURRENT_DIR, '../../../../');
const DEFAULT_STRUCTURED_DATA_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const EPOCH_ISO = new Date(0).toISOString();

function nowMs(): number {
  return Date.now();
}

function resolveStructuredDataDir(): string {
  const configured = process.env.MCP_STRUCTURED_DATA_DIR;
  if (!configured?.trim()) return DEFAULT_STRUCTURED_DATA_DIR;
  return path.resolve(configured);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readServerVersion(): string {
  try {
    const packageJson = readJson<{ version?: string }>(path.join(PACKAGE_ROOT, 'package.json'));
    return packageJson.version ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
}

function sanitizeFileName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ToolError('OODS-S016', 'artifact filename is empty');
  }
  if (path.isAbsolute(trimmed) || trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new ToolError('OODS-S017', `artifact filename is unsafe: ${trimmed}`, { filename: trimmed });
  }
  return trimmed;
}

function resolveArtifactPath(structuredDataDir: string, manifest: ManifestDoc, artifactName: string): string {
  const artifact = manifest.artifacts?.find((entry) => entry.name === artifactName);
  const filename = artifact?.file ? sanitizeFileName(artifact.file) : undefined;
  if (!filename) {
    throw new ToolError('OODS-N007', `artifact "${artifactName}" missing from manifest`, { artifact: artifactName });
  }
  const fullPath = path.join(structuredDataDir, filename);
  if (!fs.existsSync(fullPath)) {
    throw new ToolError('OODS-N007', `artifact "${artifactName}" file not found: ${filename}`, { artifact: artifactName, filename });
  }
  return fullPath;
}

function readRegistryInfo(structuredDataDir: string): {
  components: number;
  traits: number;
  objects: number;
  lastSync: string;
  manifest: ManifestDoc;
} {
  const manifestPath = path.join(structuredDataDir, 'manifest.json');
  const manifest = readJson<ManifestDoc>(manifestPath);
  const componentsPath = resolveArtifactPath(structuredDataDir, manifest, 'components');
  const payload = readJson<Record<string, unknown>>(componentsPath);

  const stats = (typeof payload.stats === 'object' && payload.stats && !Array.isArray(payload.stats))
    ? payload.stats as Record<string, unknown>
    : {};
  const components = typeof stats.componentCount === 'number'
    ? stats.componentCount
    : Array.isArray(payload.components) ? payload.components.length : 0;
  const traits = typeof stats.traitCount === 'number'
    ? stats.traitCount
    : Array.isArray(payload.traits) ? payload.traits.length : 0;
  const objects = typeof stats.objectCount === 'number'
    ? stats.objectCount
    : Array.isArray(payload.objects) ? payload.objects.length : 0;
  const lastSync = typeof payload.generatedAt === 'string'
    ? payload.generatedAt
    : typeof manifest.generatedAt === 'string'
      ? manifest.generatedAt
      : EPOCH_ISO;

  return {
    components: Number.isFinite(components) ? components : 0,
    traits: Number.isFinite(traits) ? traits : 0,
    objects: Number.isFinite(objects) ? objects : 0,
    lastSync,
    manifest,
  };
}

function readTokenInfo(structuredDataDir: string, manifest: ManifestDoc): { built: boolean; theme: string; brand: string } {
  const theme = process.env.MCP_THEME ?? 'light';
  const brand = process.env.MCP_BRAND ?? 'A';

  try {
    resolveArtifactPath(structuredDataDir, manifest, 'tokens');
    return { built: true, theme, brand };
  } catch {
    return { built: false, theme, brand };
  }
}

async function readSchemaInfo(): Promise<{ savedCount: number; storeDir: string }> {
  const store = new SchemaStore({
    ...(process.env.MCP_SCHEMA_STORE_ROOT ? { projectRoot: process.env.MCP_SCHEMA_STORE_ROOT } : {}),
    ...(process.env.MCP_SCHEMA_STORE_DIR ? { storeDir: process.env.MCP_SCHEMA_STORE_DIR } : {}),
  });
  const saved = await store.list();
  return {
    savedCount: saved.length,
    storeDir: store.storeDir,
  };
}

export async function handle(input?: HealthInput): Promise<HealthOutput> {
  const started = nowMs();
  const warnings: string[] = [];
  const structuredDataDir = resolveStructuredDataDir();

  let registry = { components: 0, traits: 0, objects: 0, lastSync: EPOCH_ISO };
  let tokenInfo = { built: false, theme: process.env.MCP_THEME ?? 'light', brand: process.env.MCP_BRAND ?? 'A' };
  try {
    const registryInfo = readRegistryInfo(structuredDataDir);
    let objectCount = registryInfo.objects;
    try {
      objectCount = listObjects().length;
    } catch {
      // Fall back to structured data stats if object loader unavailable
    }
    registry = {
      components: registryInfo.components,
      traits: registryInfo.traits,
      objects: objectCount,
      lastSync: registryInfo.lastSync,
    };
    tokenInfo = readTokenInfo(structuredDataDir, registryInfo.manifest);
    if (!tokenInfo.built) {
      warnings.push('tokens subsystem unavailable: tokens artifact not found');
    }
  } catch (error) {
    warnings.push(`registry subsystem unavailable: ${(error as Error).message}`);
    warnings.push('tokens subsystem unavailable: manifest/components unavailable');
  }

  let schemaInfo = { savedCount: 0, storeDir: path.resolve(process.cwd(), '.oods/schemas') };
  try {
    schemaInfo = await readSchemaInfo();
  } catch (error) {
    warnings.push(`schema store unavailable: ${(error as Error).message}`);
  }

  const latency = Math.max(0, nowMs() - started);
  const status: HealthOutput['status'] = warnings.length > 0 ? 'degraded' : 'ok';

  const result: HealthOutput = {
    status,
    server: {
      version: readServerVersion(),
      uptime: Math.max(0, Math.round(process.uptime() * 1000)),
    },
    registry,
    tokens: tokenInfo,
    schemas: schemaInfo,
    latency,
    dslVersion: CURRENT_VERSION,
    ...(warnings.length > 0 ? { warnings } : {}),
  };

  if (input?.includeChangelog) {
    result.changelog = getChangelogSince(input.sinceVersion);
  }

  return result;
}

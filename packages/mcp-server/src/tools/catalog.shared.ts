import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withinAllowed } from '../lib/security.js';

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
  artifacts?: ManifestArtifact[];
};

export type ComponentsDatasetLike = {
  stats?: { componentCount?: number | null } | null;
  components?: unknown[] | null;
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const MANIFEST_PATH = path.join(ARTIFACT_DIR, 'manifest.json');

function readJson<T = Record<string, unknown>>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function sanitizeManifestFile(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Manifest file entry is empty');
  }
  if (path.isAbsolute(trimmed) || trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error(`Manifest file entry is not a safe filename: ${trimmed}`);
  }
  return trimmed;
}

export function getLatestComponentsFile(): string {
  try {
    const manifest = readJson<ManifestDoc>(MANIFEST_PATH);
    const componentsArtifact = manifest.artifacts?.find((a) => a.name === 'components');

    if (!componentsArtifact?.file) {
      throw new Error('Components artifact not found in manifest');
    }

    const filename = sanitizeManifestFile(componentsArtifact.file);
    const fullPath = path.join(ARTIFACT_DIR, filename);
    if (!withinAllowed(ARTIFACT_DIR, fullPath)) {
      throw new Error(`Components artifact file resolves outside artifact dir: ${filename}`);
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Components artifact file not found: ${filename}`);
    }

    return fullPath;
  } catch (error) {
    throw new Error(`Failed to locate components file: ${(error as Error).message}`);
  }
}

export function readComponentsDataset<T = Record<string, unknown>>(): T {
  const componentsFilePath = getLatestComponentsFile();
  return readJson<T>(componentsFilePath);
}

export function resolveComponentCount(dataset: ComponentsDatasetLike): number {
  const count = dataset?.stats?.componentCount;
  if (typeof count === 'number' && Number.isFinite(count)) {
    return count;
  }
  if (Array.isArray(dataset?.components)) {
    return dataset.components.length;
  }
  return 0;
}
